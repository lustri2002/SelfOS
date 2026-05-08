"use client";

import dynamic from "next/dynamic";

const UniversalInbox = dynamic(() => import("./UniversalInbox"), {
  ssr: false,
});

export default function UniversalInboxLazy() {
  return <UniversalInbox />;
}
