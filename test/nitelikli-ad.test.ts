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

test("qualified tip, composite ve yapı oluşturma her segmentin aralığını korur", () => {
  const sonuç = ayrıştır(kaynakOluştur("tip.ata", 'sabit k: liste<m::K?> = [m::K { ad: "Ata" }]'));
  expect(sonuç.tanılar).toEqual([]);
  expect(sonuç.program?.bildirimler[0]).toMatchObject({
    açıkTip: {
      tür: "liste-tipi",
      eleman: {
        tür: "isteğe-bağlı-tip",
        temel: {
          tür: "nitelikli-tip",
          parçalar: [
            { ad: "m", aralık: { başlangıç: { ofset: 15 }, bitiş: { ofset: 16 } } },
            { ad: "K", aralık: { başlangıç: { ofset: 18 }, bitiş: { ofset: 19 } } },
          ],
        },
      },
    },
    başlangıç: {
      tür: "liste",
      elemanlar: [{ tür: "yapı-oluşturma", yapıYolu: [{ ad: "m" }, { ad: "K" }] }],
    },
  });
});

test("malformed qualified type yolları normal parser tanısı verir", () => {
  for (const tip of ["m::", "::K", "m::::K", "liste<m::>"]) {
    const sonuç = ayrıştır(kaynakOluştur("tip.ata", `sabit k: ${tip} = yok`));
    expect(sonuç.tanılar.map((t) => t.kod)).toEqual(["ATA2001"]);
    expect(sonuç.program).toBeNull();
  }
});
