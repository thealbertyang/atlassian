import { type TextDocument, window, workspace } from "vscode";
import { asNotify, asSubject, type Publisher } from "@jsonrpc-rx/server";
import { MessageService } from "../service/message.service";

const messageService = new MessageService();

export const createMessageHandlers = () => ({
  showInformation: asNotify((message: string) => {
    window.showInformationMessage(message);
  }),

  registerChannel: (channel: string) => {
    messageService.register(channel);
  },

  unregisterChannel: (channel: string) => messageService.unregister(channel),

  sendMessage: (channel: string, message: unknown) => messageService.sendMessage(channel, message),

  addMessageListener(channel: string, listener: (msg: unknown) => void): Promise<number> {
    return messageService.addMessageListener(channel, listener);
  },

  rmMessageListener(channel: string, listenerNumber: number) {
    return messageService.rmMessageListener(channel, listenerNumber);
  },

  onDidOpenTextDocument: asSubject(({ next }: Publisher<TextDocument>) => {
    const disposable = workspace.onDidOpenTextDocument((file) => next(file));
    return disposable.dispose.bind(disposable);
  }),
});
