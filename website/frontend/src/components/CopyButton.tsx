import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/languageContext";

type CopyButtonProps = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label }: CopyButtonProps) {
  const { localization } = useLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy}>
      {copied ? localization.admin.b_copied : (label ?? localization.admin.b_copy)}
    </button>
  );
}
