import { wrap } from "@jsonrpc-rx/client";
import type { HandlersType } from "../types/handlers";
import { useContext, useMemo } from "react";
import { JsonrpcClientContext } from "../contexts/jsonrpc-rx-context";

export const useHandlers = () => {
  const jsonrpcClient = useContext(JsonrpcClientContext);
  if (jsonrpcClient == null) {
    throw new Error("useHandlers must be used within a JsonrpcClientContextProvider");
  }
  return useMemo(() => wrap<HandlersType>(jsonrpcClient), [jsonrpcClient]);
};
