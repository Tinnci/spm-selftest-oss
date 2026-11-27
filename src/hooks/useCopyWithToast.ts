import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/clipboard";

export function useCopyWithToast() {
  const { t } = useTranslation();
  const toast = useToast();

  return useCallback(
    async (text: string, successMessage?: string) => {
      try {
        await copyText(text);
        toast.success(successMessage ?? t("selftest.copied"));
        return true;
      } catch {
        toast.error(t("selftest.copyFailed"));
        return false;
      }
    },
    [toast, t],
  );
}
