import useSWR from "swr";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApiHost } from "@/api";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import axios, { AxiosError } from "axios";
import copy from "copy-to-clipboard";
import { useTheme } from "@/context/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LuCopy, LuSave } from "react-icons/lu";
import { MdOutlineRestartAlt } from "react-icons/md";
import RestartDialog from "@/components/overlay/dialog/RestartDialog";
import { useTranslation } from "react-i18next";
import { useRestart } from "@/api/ws";
import { useResizeObserver } from "@/hooks/resize-observer";
import { FrigateConfig } from "@/types/frigateConfig";
import { cn } from "@/lib/utils";

type SaveOptions = "saveonly" | "restart";

type ApiErrorResponse = {
  message?: string;
  detail?: string;
};

const dashboardEditorTheme = "frigate-dashboard-dark";

function defineDashboardEditorTheme() {
  monaco.editor.defineTheme(dashboardEditorTheme, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "cbd5e1", background: "08090b" },
      { token: "comment", foreground: "6b8e5f", fontStyle: "italic" },
      { token: "keyword", foreground: "5cc8b2" },
      { token: "number", foreground: "d9a06f" },
      { token: "string", foreground: "c7926f" },
      { token: "type", foreground: "7db7ff" },
    ],
    colors: {
      "editor.background": "#08090b",
      "editor.foreground": "#cbd5e1",
      "editor.lineHighlightBackground": "#131820",
      "editor.selectionBackground": "#28435f",
      "editor.inactiveSelectionBackground": "#1f2b38",
      "editorCursor.foreground": "#7db7ff",
      "editorLineNumber.foreground": "#647184",
      "editorLineNumber.activeForeground": "#cbd5e1",
      "editorGutter.background": "#08090b",
      "editorIndentGuide.background1": "#26313d",
      "editorIndentGuide.activeBackground1": "#4a5b6d",
      "scrollbarSlider.background": "#64718444",
      "scrollbarSlider.hoverBackground": "#7db7ff55",
      "scrollbarSlider.activeBackground": "#7db7ff77",
      "minimap.background": "#08090b",
      "minimapSlider.background": "#64718433",
      "minimapSlider.hoverBackground": "#7db7ff44",
      "minimapSlider.activeBackground": "#7db7ff66",
    },
  });
}

function ConfigEditor() {
  const { t } = useTranslation(["views/configEditor"]);
  const apiHost = useApiHost();

  useEffect(() => {
    document.title = t("documentTitle");
  }, [t]);

  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });
  const { data: rawConfig } = useSWR<string>("config/raw");

  const { theme, systemTheme } = useTheme();
  const [error, setError] = useState<string | undefined>();

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const configRef = useRef<HTMLDivElement | null>(null);
  const schemaConfiguredRef = useRef(false);

  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const { send: sendRestart } = useRestart();
  const initialValidationRef = useRef(false);

  const onHandleSaveConfig = useCallback(
    async (save_option: SaveOptions): Promise<void> => {
      if (!editorRef.current) {
        return;
      }

      try {
        const response = await axios.post(
          `config/save?save_option=${save_option}`,
          editorRef.current.getValue(),
          {
            headers: { "Content-Type": "text/plain" },
          },
        );

        if (response.status === 200) {
          setError("");
          setHasChanges(false);
          toast.success(response.data.message, { position: "top-center" });
        }
      } catch (error) {
        toast.error(t("toast.error.savingError"), { position: "top-center" });

        const axiosError = error as AxiosError<ApiErrorResponse>;
        const errorMessage =
          axiosError.response?.data?.message ||
          axiosError.response?.data?.detail ||
          "Unknown error";

        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [editorRef, t],
  );

  const handleCopyConfig = useCallback(async () => {
    if (!editorRef.current) {
      return;
    }

    copy(editorRef.current.getValue());
    toast.success(t("toast.success.copyToClipboard"), {
      position: "top-center",
    });
  }, [editorRef, t]);

  const handleSaveAndRestart = useCallback(async () => {
    try {
      await onHandleSaveConfig("saveonly");
      setRestartDialogOpen(true);
    } catch (error) {
      // If save fails, error is already set in onHandleSaveConfig, no dialog opens
    }
  }, [onHandleSaveConfig]);

  useEffect(() => {
    if (!rawConfig) {
      return;
    }

    defineDashboardEditorTheme();

    const modelUri = monaco.Uri.parse(
      `a://b/api/config/schema_${Date.now()}.json`,
    );

    // Configure Monaco YAML schema only once
    if (!schemaConfiguredRef.current) {
      configureMonacoYaml(monaco, {
        enableSchemaRequest: true,
        hover: true,
        completion: true,
        validate: true,
        format: true,
        schemas: [
          {
            uri: `${apiHost}api/config/schema.json`,
            fileMatch: [String(modelUri)],
          },
        ],
      });
      schemaConfiguredRef.current = true;
    }

    if (!modelRef.current) {
      modelRef.current = monaco.editor.createModel(rawConfig, "yaml", modelUri);
    } else {
      modelRef.current.setValue(rawConfig);
    }

    const container = configRef.current;

    if (container && !editorRef.current) {
      const isSmallViewport = window.innerWidth < 768;

      editorRef.current = monaco.editor.create(container, {
        language: "yaml",
        model: modelRef.current,
        automaticLayout: true,
        fontFamily:
          '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 14,
        lineHeight: 22,
        lineNumbersMinChars: 3,
        minimap: { enabled: !isSmallViewport },
        overviewRulerBorder: false,
        padding: { top: 10, bottom: 10 },
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        theme:
          (systemTheme || theme) == "dark" ? dashboardEditorTheme : "vs-light",
        wordWrap: isSmallViewport ? "on" : "off",
      });
      editorRef.current?.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          onHandleSaveConfig("saveonly");
        },
      );
    } else if (editorRef.current) {
      editorRef.current.setModel(modelRef.current);
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
      schemaConfiguredRef.current = false;
    };
  }, [rawConfig, apiHost, systemTheme, theme, onHandleSaveConfig]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    monaco.editor.setTheme(
      (systemTheme || theme) == "dark" ? dashboardEditorTheme : "vs-light",
    );
  }, [systemTheme, theme]);

  // when in safe mode, attempt to validate the existing (invalid) config immediately
  // so that the user sees the validation errors without needing to press save
  useEffect(() => {
    if (
      config?.safe_mode &&
      rawConfig &&
      !initialValidationRef.current &&
      !error
    ) {
      initialValidationRef.current = true;
      axios
        .post(`config/save?save_option=saveonly`, rawConfig, {
          headers: { "Content-Type": "text/plain" },
        })
        .then(() => {
          // if this succeeds while in safe mode, we won't force any UI change
        })
        .catch((e: AxiosError<ApiErrorResponse>) => {
          const errorMessage =
            e.response?.data?.message ||
            e.response?.data?.detail ||
            "Unknown error";
          setError(errorMessage);
        });
    }
  }, [config?.safe_mode, rawConfig, error]);

  // monitoring state

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!rawConfig || !modelRef.current) {
      return;
    }

    modelRef.current.onDidChangeContent(() => {
      if (modelRef.current?.getValue() != rawConfig) {
        setHasChanges(true);
      } else {
        setHasChanges(false);
      }
    });
  }, [rawConfig]);

  useEffect(() => {
    if (rawConfig && modelRef.current) {
      modelRef.current.setValue(rawConfig);
      setHasChanges(false);
    }
  }, [rawConfig]);

  useEffect(() => {
    let listener: ((e: BeforeUnloadEvent) => void) | undefined;
    if (hasChanges) {
      listener = (e) => {
        e.preventDefault();
        e.returnValue = true;
        return t("confirm");
      };
      window.addEventListener("beforeunload", listener);
    }

    return () => {
      if (listener) {
        window.removeEventListener("beforeunload", listener);
      }
    };
  }, [hasChanges, t]);

  // layout change handler

  const [{ width, height }] = useResizeObserver(configRef);

  useEffect(() => {
    if (editorRef.current) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(() => {
        editorRef.current?.layout();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [error, width, height]);

  if (!rawConfig) {
    return (
      <div className="flex size-full items-center justify-center bg-[#08090b]">
        <ActivityIndicator />
      </div>
    );
  }

  return (
    <div
      className="flex size-full flex-col overflow-hidden text-slate-100"
      style={{
        background:
          "radial-gradient(circle at 48% -20%, rgba(90, 167, 255, 0.09), transparent 34%), linear-gradient(180deg, rgba(18, 24, 32, 0.98), #08090b 46%), #08090b",
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(203,213,225,0.11)] bg-[rgba(13,17,20,0.82)] px-3 py-3 backdrop-blur-xl md:px-6 md:py-[14px]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-slate-100">
              {t(config?.safe_mode ? "safeConfigEditor" : "configEditor")}
            </h1>
            {hasChanges && (
              <span className="rounded border border-[#7db7ff]/20 bg-[#7db7ff]/10 px-2 py-0.5 text-xs font-medium text-[#7db7ff]">
                {t("unsavedChanges", { defaultValue: "Unsaved" })}
              </span>
            )}
          </div>
          {config?.safe_mode && (
            <div className="mt-1 truncate text-sm text-slate-400">
              {t("safeModeDescription")}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <HeaderActionButton
            aria-label={t("copyConfig")}
            onClick={() => handleCopyConfig()}
          >
            <LuCopy className="size-4" />
            <span className="hidden md:block">{t("copyConfig")}</span>
          </HeaderActionButton>
          <HeaderActionButton
            aria-label={t("saveAndRestart")}
            onClick={handleSaveAndRestart}
          >
            <div className="relative size-5">
              <LuSave className="absolute left-0 top-0 size-3" />
              <MdOutlineRestartAlt className="absolute size-4 translate-x-1 translate-y-1/2" />
            </div>
            <span className="hidden md:block">{t("saveAndRestart")}</span>
          </HeaderActionButton>
          <HeaderActionButton
            aria-label={t("saveOnly")}
            onClick={() => onHandleSaveConfig("saveonly")}
          >
            <LuSave className="size-4" />
            <span className="hidden md:block">{t("saveOnly")}</span>
          </HeaderActionButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-2.5 md:p-4">
        {error && (
          <div className="max-h-[30%] min-h-[2.5rem] overflow-auto whitespace-pre-wrap rounded-[4px] border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300 shadow-[0_12px_36px_rgba(0,0,0,0.24)] md:max-h-[40%]">
            {error}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#08090b] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <div ref={configRef} className="size-full overflow-hidden" />
        </div>
      </div>

      <Toaster closeButton={true} />
      <RestartDialog
        isOpen={restartDialogOpen}
        onClose={() => setRestartDialogOpen(false)}
        onRestart={() => sendRestart("restart")}
      />
    </div>
  );
}

function HeaderActionButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-[34px] min-w-[34px] items-center justify-center gap-2 rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#131820] px-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7db7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090b] disabled:pointer-events-none disabled:opacity-50 md:px-3",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export default ConfigEditor;
