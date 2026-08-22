"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { DEVNET_RPC } from "@/lib/solana";

import "@solana/wallet-adapter-react-ui/styles.css";

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Phantom and Solflare are passed explicitly (not just relying on Wallet
// Standard auto-detection) because their adapters implement mobile deep
// linking. WalletConnect is added as a catch-all for any other wallet app via
// QR / deep link; it's constructed defensively so a misconfiguration can never
// take the working Phantom/Solflare path down with it.
function walletConnectAdapter(): WalletConnectWalletAdapter[] {
  if (!WALLETCONNECT_PROJECT_ID) return [];
  try {
    return [
      new WalletConnectWalletAdapter({
        network: WalletAdapterNetwork.Devnet,
        options: {
          projectId: WALLETCONNECT_PROJECT_ID,
          metadata: {
            name: "Tiba",
            description: "Payments that arrive when work is done.",
            url: "https://usetiba.vercel.app",
            icons: ["https://usetiba.vercel.app/favicon.ico"],
          },
        },
      }),
    ];
  } catch {
    return [];
  }
}

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      ...walletConnectAdapter(),
    ],
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
