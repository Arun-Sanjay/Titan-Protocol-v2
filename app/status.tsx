import React from "react";
import { StatusWindow } from "../src/components/ui/StatusWindow";
import { useRouter } from "expo-router";

export default function StatusScreen() {
  const router = useRouter();
  return <StatusWindow onClose={() => router.back()} />;
}
