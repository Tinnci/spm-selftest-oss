# The tab-separated output keeps individual probe errors from failing the capture.
probe() {
    key=$1
    source=$2
    shift 2
    result=$("$@" 2>&1)
    status=$?
    if [ "$status" -ne 0 ]; then
        case "$result" in
            *"Permission denied"*|*"Operation not permitted"*) status=denied ;;
            *"No such file or directory"*|*"not found"*) status=unavailable ;;
            *) status=failed ;;
        esac
        printf 'A\t%s\t%s\t%s\t\n' "$key" "$status" "$source"
    else
        printf '%s\n' "$result" | awk -v key="$key" -v source="$source" '
            NF && count++ < 48 { print "A\t" key "\tok\t" source "\t" substr($0, 1, 1000) }
            END { if (!count) print "A\t" key "\tunavailable\t" source "\t" }
        '
    fi
}

node() {
    probe "$1" "$2" head -n 12 "$2"
}

touch_input() {
    data=$(dumpsys input) || return 1
    printf '%s\n' "$data" | awk '
        /^ *[0-9]+: / { name=$0; sub(/^ *[0-9]+: /, "", name); touch=0 }
        /Classes: .*TOUCH/ { touch=1 }
        /Path: \/dev\/input\/event[0-9]+$/ && touch && name != "" {
            print name "\t" $NF; touch=0
        }
    ' | while IFS="$(printf '\t')" read -r name path; do
        sys="/sys/class/input/${path##*/}/device"
        target=$(readlink -f "$sys")
        printf '%s (%s) %s\n' "$name" "$path" "$target"
        bus_device=$target
        while [ -n "$bus_device" ] && [ "$bus_device" != "/" ]; do
            driver=$(readlink "$bus_device/driver" 2>/dev/null)
            if [ -n "$driver" ]; then
                printf 'driver=%s device=%s\n' "${driver##*/}" "$bus_device"
                break
            fi
            bus_device=${bus_device%/*}
        done
    done
}

touch_version() {
    for input in /sys/class/input/event*; do
        parent=$(readlink -f "$input/device") || continue
        while [ -n "$parent" ] && [ "$parent" != "/" ]; do
            driver=$(readlink "$parent/driver" 2>/dev/null)
            case "${driver##*/}" in
                gcore)
                    probe tp_controller_version "$parent/fw_ver" head -n 1 "$parent/fw_ver"
                    return ;;
                chipone-tddi)
                    probe tp_controller_version "$parent/cts_firmware/curr_version" head -n 1 "$parent/cts_firmware/curr_version"
                    probe tp_builtin_firmware "$parent/cts_firmware/driver_builtin_firmware" head -n 48 "$parent/cts_firmware/driver_builtin_firmware"
                    return ;;
            esac
            parent=${parent%/*}
        done
    done
    printf 'A\ttp_controller_version\tunavailable\t/sys/class/input\t\n'
}

touch_firmware_headers() {
    for path in /odm/firmware/gcore_tp_fw_*.bin /vendor/firmware/gcore_tp_fw_*.bin; do
        [ -f "$path" ] || continue
        version=$(od -An -tx1 -j 65524 -N 4 "$path") || return 1
        [ -n "$version" ] && printf '%s:%s\n' "$path" "$version"
    done
    return 0
}

touch_firmware_log() {
    data=$(dmesg) || return 1
    printf '%s\n' "$data" | grep -Ei 'gcore.*(fw bin ver:|fw buf ver:)|chipone.*firmware version:' | tail -n 12
}

fingerprint_bindings() {
    for root in /sys/bus/platform/drivers /sys/bus/spi/drivers; do
        for driver in "$root"/goodix* "$root"/silead* "$root"/*fingerprint*; do
            [ -d "$driver" ] || continue
            for path in "$driver"/*; do
                [ -L "$path" ] || continue
                [ "${path##*/}" = module ] || printf '%s: %s\n' "${driver##*/}" "${path##*/}"
            done
        done
    done
}

drm_connector() {
    for path in /sys/class/drm/*/status; do
        [ -f "$path" ] || continue
        printf '%s ' "${path%/status}"
        cat "$path" || return
    done
}

camera_config() {
    config=$(cat "$1") || return 1
    printf '%s\n' "$config" | grep -E '<(SensorName|TuningName|SensorPosition)>' || :
}

camera_state() {
    data=$(dumpsys media.camera) || return 1
    printf '%s\n' "$data" | grep -E '^ *Number of (normal )?camera devices:|^ *Device [0-9]+ is (open|closed)' || :
}

sensors() {
    data=$(dumpsys sensorservice) || return 1
    printf '%s\n' "$data" | grep -E '\|.*type: android\.sensor\.(accelerometer|light|proximity|gyroscope|magnetic_field)\(' || :
}

sensorhub_version() {
    data=$(dmesg) || return 1
    printf '%s\n' "$data" | grep -i 'sensorhub.*CM4 Version:' | tail -n 1
}

panel_boot() {
    data=$(cat /proc/cmdline) || return 1
    printf '%s\n' "$data" | tr ' ' '\n' | grep -E '^(lcd_name|panel_name|androidboot\.(lcd|panel)[^=]*)=' || :
}

power_drivers() {
    for path in /sys/class/power_supply/*; do
        driver=$(readlink "$path/device/driver" 2>/dev/null) || continue
        printf '%s: %s\n' "${path##*/}" "${driver##*/}"
    done
}

node tp /proc/Sprocomm_TpInfo
node lcd /proc/Sprocomm_LcdInfo
probe lcd_boot /proc/cmdline panel_boot
probe lcd_connector /sys/class/drm drm_connector
probe tp_input 'dumpsys input' touch_input
touch_version
probe tp_firmware_files /odm/firmware touch_firmware_headers
probe tp_firmware_log dmesg touch_firmware_log
probe fingerprint_bindings /sys/bus fingerprint_bindings
probe adb_uid 'id -u' id -u
probe selinux getenforce getenforce

for name in Memory Storage Storage_fwrev back_camera_name front_camera_name back2_camera_name front2_camera_name back3_camera_name Fingerprint Gsensor PSensor LightSensor GyroSensor MagSensor Battery; do
    node "$name" "/sys/devices/deviceinfo/$name"
done
for name in ddr_info property ddr_name; do
    node "ddr_$name" "/proc/sprd_dmc/$name"
done
for name in name manfid prv fwrev life_time pre_eol_info; do
    node "emmc_$name" "/sys/class/block/mmcblk0/device/$name"
done
node emmc_size_sectors /sys/class/block/mmcblk0/size
for name in technology charge_full_design; do
    node "battery_$name" "/sys/class/power_supply/battery/$name"
done
probe battery_drivers /sys/class/power_supply power_drivers
probe camera_config /odm/etc/sensor_config.xml camera_config /odm/etc/sensor_config.xml
probe camera_state 'dumpsys media.camera' camera_state
probe sensors 'dumpsys sensorservice' sensors
probe sensorhub_version dmesg sensorhub_version
