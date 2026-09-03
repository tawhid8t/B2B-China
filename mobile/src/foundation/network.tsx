import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";

const NetworkContext = createContext({ isConnected: true });

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isConnected, setIsConnected] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const next = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected(next);
      onlineManager.setOnline(next);
    });
    return unsubscribe;
  }, []);
  return <NetworkContext.Provider value={{ isConnected }}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
