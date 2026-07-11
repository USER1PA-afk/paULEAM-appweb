"use client";

import { getNextDeliveryWindow } from "@shared/lib/utils";

export function DeliveryInfoBanner() {
  const { deadline, deliveryDate } = getNextDeliveryWindow();

  const fmtDeadline = deadline.toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
  const fmtDelivery = deliveryDate.toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });

  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800
        dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-400 bg-blue-100
          text-[11px] font-bold text-blue-700 dark:border-blue-600 dark:bg-blue-900/50 dark:text-blue-300"
      >
        !
      </span>
      <p>
        Realiza tu pedido antes del{" "}
        <strong className="font-semibold">{fmtDeadline} a las 5:00 PM</strong> y lo
        recibirás el{" "}
        <strong className="font-semibold">{fmtDelivery}</strong> en la dirección
        indicada.
      </p>
    </div>
  );
}
