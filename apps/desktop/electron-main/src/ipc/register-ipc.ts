import type { BrowserWindow, IpcMain, IpcMainInvokeEvent, OpenDialogOptions, Shell } from "electron";

import { DESKTOP_CHANNELS } from "../../../shared/src/index.js";
import type {
  ExportRequest,
  OutputDirectoryResult,
  ProductSelectionResult,
  UiRenderInput,
} from "../../../shared/src/index.js";
import type { DesktopController } from "../desktop-controller.js";
import { exportRequestSchema, parseIpcPayload, previewRequestSchema, revealRequestSchema } from "./schemas.js";

type DialogPort = {
  showOpenDialog(
    window: BrowserWindow,
    options: OpenDialogOptions,
  ): Promise<{ canceled: boolean; filePaths: string[] }>;
};

export type RegisterDesktopIpcOptions = {
  ipcMain: IpcMain;
  window: BrowserWindow;
  rendererUrl: string;
  controller: DesktopController;
  dialog: DialogPort;
  shell: Pick<Shell, "showItemInFolder">;
  e2eProductPath?: string;
  e2eOutputPath?: string;
};

function assertTrustedSender(event: IpcMainInvokeEvent, options: RegisterDesktopIpcOptions): void {
  const senderFrame = event.senderFrame;
  if (
    !senderFrame ||
    event.sender.id !== options.window.webContents.id ||
    senderFrame.url !== options.rendererUrl ||
    senderFrame !== senderFrame.top
  ) {
    throw new Error("DESKTOP-IPC-002:untrusted_sender");
  }
}

export function registerDesktopIpc(options: RegisterDesktopIpcOptions): void {
  const handle = <TArgs extends unknown[], TResult>(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>,
  ) => {
    options.ipcMain.removeHandler(channel);
    options.ipcMain.handle(channel, async (event, ...args: TArgs) => {
      assertTrustedSender(event, options);
      return listener(event, ...args);
    });
  };

  handle(DESKTOP_CHANNELS.selectProductPng, async (): Promise<ProductSelectionResult> => {
    let selectedPath: string | undefined;
    if (options.e2eProductPath) {
      selectedPath = options.e2eProductPath;
    } else {
      const result = await options.dialog.showOpenDialog(options.window, {
      title: "제품 이미지 선택",
      properties: ["openFile", "dontAddToRecent"],
      filters: [{ name: "이미지 파일", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (result.canceled || result.filePaths.length === 0) return { status: "CANCELLED" };
      selectedPath = result.filePaths[0];
    }
    if (!selectedPath) return { status: "CANCELLED" };
    return options.controller.selectProductFromPath(selectedPath);
  });

  handle(DESKTOP_CHANNELS.clearProduct, async (): Promise<void> => {
    await options.controller.clearProduct();
  });

  handle(DESKTOP_CHANNELS.requestPreview, async (_event, raw: unknown) => {
    return options.controller.requestPreview(parseIpcPayload(previewRequestSchema, raw) as UiRenderInput);
  });

  handle(DESKTOP_CHANNELS.selectOutputDirectory, async (): Promise<OutputDirectoryResult> => {
    let selectedPath: string | undefined;
    if (options.e2eOutputPath) {
      selectedPath = options.e2eOutputPath;
    } else {
      const result = await options.dialog.showOpenDialog(options.window, {
        title: "출력 폴더 선택",
        properties: ["openDirectory", "createDirectory", "dontAddToRecent"],
      });
      if (result.canceled || result.filePaths.length === 0) return { status: "CANCELLED" };
      selectedPath = result.filePaths[0];
    }
    if (!selectedPath) return { status: "CANCELLED" };
    try {
      const selected = await options.controller.registerOutputDirectory(selectedPath);
      return { status: "SELECTED", outputDirectoryToken: selected.token, displayName: selected.displayName };
    } catch (error) {
      return {
        status: "ERROR",
        code: "DESKTOP-OUTPUT-003",
        message: error instanceof Error ? error.message : "출력 폴더를 사용할 수 없습니다.",
      };
    }
  });

  handle(DESKTOP_CHANNELS.exportRender, async (_event, raw: unknown) => {
    return options.controller.exportRender(parseIpcPayload(exportRequestSchema, raw) as ExportRequest);
  });

  handle(DESKTOP_CHANNELS.revealExportedFile, async (_event, raw: unknown): Promise<void> => {
    const token = parseIpcPayload(revealRequestSchema, raw);
    const exported = options.controller.getExportPaths(token);
    options.shell.showItemInFolder(exported.pngPath);
  });

  handle(DESKTOP_CHANNELS.getAppInfo, async () => options.controller.getAppInfo());
}
