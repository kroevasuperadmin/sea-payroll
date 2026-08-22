"use client";

import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { DEVNET_RPC } from "@/lib/solana";

import "@solana/wallet-adapter-react-ui/styles.css";

// No legacy adapters passed in deliberately: modern wallets (Phantom,
// Solflare, Backpack, and their mobile in-app browsers) all self-register
// via the Wallet Standard. Explicitly instantiating the old
// @solana/wallet-adapter-phantom class alongside that creates a duplicate,
// stale registration that hangs on "Connecting..." instead of resolving.
export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ConnectionProvider endpoint={DEVNET_RPC}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
