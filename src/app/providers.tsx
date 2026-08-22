"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { DEVNET_RPC } from "@/lib/solana";

import "@solana/wallet-adapter-react-ui/styles.css";

// Phantom and Solflare are passed explicitly (not just relying on Wallet
// Standard auto-detection) because their adapters implement mobile deep
// linking: on a phone with no browser extension, tapping the button opens
// the Phantom/Solflare app to approve (or the App Store if not installed).
// Wallet-adapter-react dedupes against any Wallet-Standard-injected instance
// of the same wallet, so this is safe alongside desktop extensions too.
export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={DEVNET_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
