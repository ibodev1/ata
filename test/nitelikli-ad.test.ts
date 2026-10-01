import { expect, test } from "bun:test";
import { ayrıştır, kaynakOluştur } from "../src/index.ts";

test("parser nitelikli ifade yolunu semantik karar vermeden segment aralıklarıyla taşır", () => {
  const sonuç = ayrıştır(kaynakOluştur("ad.ata", "a::b::c(1)"));
  expect(sonuç.tanılar).toEqual([]);
  const bildirim = sonuç.program?.bildirimler[0];
  if (bildirim?.tür !== "ifade-bildirimi" || bildirim.ifade.tür !== "çağrı")
    throw new Error("Çağrı bekleniyordu.");
  expect(bildirim.ifade.çağrılan).toMatchObject({
    tür: "nitelikli-ad",
    parçalar: [
      { ad: "a", aralık: { başlangıç: { ofset: 0 }, bitiş: { ofset: 1 } } },
      { ad: "b", aralık: { başlangıç: { ofset: 3 }, bitiş: { ofset: 4 } } },
      { ad: "c", aralık: { başlangıç: { ofset: 6 }, bitiş: { ofset: 7 } } },
    ],
  });
});
