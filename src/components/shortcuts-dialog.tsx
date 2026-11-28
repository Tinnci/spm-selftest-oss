import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["Ctrl/⌘", "K"], labelKey: "selftest.shortcuts.search" },
  { keys: ["Ctrl/⌘", "S"], labelKey: "selftest.shortcuts.saveMeta" },
  { keys: ["Ctrl/⌘", "Enter"], labelKey: "selftest.shortcuts.collect" },
  { keys: ["↑ / ↓", "J / K"], labelKey: "selftest.shortcuts.navigate" },
  { keys: ["1 – 7"], labelKey: "selftest.shortcuts.tabs" },
  { keys: ["N"], labelKey: "selftest.shortcuts.newCollect" },
  { keys: ["R"], labelKey: "selftest.shortcuts.recheck" },
  { keys: ["Esc"], labelKey: "selftest.shortcuts.clear" },
  { keys: ["?"], labelKey: "selftest.shortcuts.help" },
  { keys: ["Alt + Click"], labelKey: "selftest.shortcuts.altCompare" },
  { keys: ["Shift + Click"], labelKey: "selftest.shortcuts.shiftSelect" },
] as const;

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog selftest-shortcuts-dialog">
        <DialogHeader>
          <DialogTitle className="workspace-dialog-title">
            {t("selftest.shortcuts.title")}
          </DialogTitle>
          <DialogDescription>
            {t("selftest.shortcuts.description")}
          </DialogDescription>
        </DialogHeader>
        <dl className="shortcuts-grid">
          {SHORTCUTS.map((item) => (
            <div key={item.labelKey} className="shortcuts-row">
              <dt className="shortcuts-keys">
                {item.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{t(item.labelKey)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
