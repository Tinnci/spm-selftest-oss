inventory() {
    group=$1
    shift
    seen=''
    for root in "$@"; do
        target=$(readlink -f "$root" 2>/dev/null)
        case "$seen" in *"|$target|"*) continue ;; esac
        [ -z "$target" ] || seen="$seen|$target|"
        (
            case "$group" in
                modules) find "$root/" -type f -name '*.ko*' ;;
                device_tree) find "$root/" -type d ;;
                *) find "$root/" \( -type f -o -type l \) ;;
            esac
            printf '@exit:%s\n' "$?"
        ) 2>&1 | awk -v group="$group" -v root="$root" '
            function candidate(path, n) {
                if (index(path, root "/") != 1) return
                if (group == "modules" && path !~ /\.ko[^\/]*$/) return
                if (group == "device_tree") {
                    n=split(path, segments, "/")
                    if (path !~ /\/lcds?(\/|$)/ && segments[n] !~ /(touch|gcore|gc7272|focal|novatek|panel|ddr|emmc|fingerprint|silead|goodix|sensorhub|battery|charger)/) return
                }
                if (!listed[path]++ && ++size <= 20000) print "I\t" group "\t" path
            }
            /^@exit:/ { code=substr($0,7); next }
            /Permission denied|Operation not permitted/ {
                denied=1
                start=index($0, root "/")
                if (start) {
                    path=substr($0,start)
                    sub(/\047?: (Permission denied|Operation not permitted).*$/, "", path)
                    candidate(path)
                }
                next
            }
            { candidate($0) }
            END {
                if (size > 20000) status="truncated"
                else if (denied && size) status="partial"
                else if (denied) status="denied"
                else if (size && code != 0) status="partial"
                else if (code == 0) status="ok"
                else status="unavailable"
                print "S\t" group "\t" status "\t" root
            }
        '
    done
}

inventory firmware /vendor/firmware /odm/firmware /vendor/lib/firmware /odm/lib/firmware /vendor/etc/firmware /odm/etc/firmware /vendor_dlkm/lib/firmware /odm_dlkm/lib/firmware /system_dlkm/lib/firmware /system/firmware /system/etc/firmware /system/lib/firmware /product/firmware /system_ext/firmware /lib/firmware
inventory modules /vendor_dlkm/lib/modules /odm_dlkm/lib/modules /system_dlkm/lib/modules /vendor/lib/modules /odm/lib/modules /lib/modules
inventory configuration /vendor/etc/camera /odm/etc/camera /vendor/etc/displayconfig /odm/etc/displayconfig /vendor/etc/sensors /odm/etc/sensors /vendor/etc/power_supply /odm/etc/power_supply
inventory device_tree /sys/firmware/devicetree/base
