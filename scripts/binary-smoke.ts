import { strict as assert } from "node:assert";
import { chmod, copyFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { version } from "../package.json";
import { derlemeHedefi, projeKökü } from "./derle.ts";

function çalıştır(komut: string[], cwd: string, binary: boolean, girdi: string | Uint8Array = "") {
  const sonuç = Bun.spawnSync(komut, {
    cwd,
    stdin: Buffer.from(girdi),
    // Binary hiçbir Bun kurulumunu PATH üzerinden bulamaz.
    env: binary ? { ...process.env, PATH: "", Path: "" } : process.env,
  });
  return { kod: sonuç.exitCode, çıktı: sonuç.stdout.toString(), hata: sonuç.stderr.toString() };
}

async function smoke() {
  const geçici = await mkdtemp(join(tmpdir(), "ata-binary Ölçü & (test)-"));
  try {
    const binary = join(geçici, derlemeHedefi([]).dosya);
    const hedef = derlemeHedefi([]);
    await copyFile(
      resolve(
        projeKökü,
        "dist",
        Bun.argv.includes("--release") ? `release/${hedef.asset}` : hedef.çıktı,
      ),
      binary,
    );
    await chmod(binary, 0o755);
    await mkdir(join(geçici, "geçici testler"));
    const özel = join("geçici testler", "öğrenci & ; ' 🌍 programı.ata");
    await Bun.write(join(geçici, özel), '"Türkçe: İı Şş Ğğ 🌍" yazdır');
    const cli = resolve(projeKökü, "src/cli/cli.ts");
    let sayı = 0;
    function karşılaştır(
      args: string[],
      kod: number,
      beklenen?: string,
      girdi: string | Uint8Array = "",
      hataÖncesiÇıktı = "",
    ) {
      const kaynak = çalıştır([process.execPath, "run", cli, ...args], geçici, false, girdi);
      const derlenmiş = çalıştır([binary, ...args], geçici, true, girdi);
      assert.deepEqual(derlenmiş, kaynak, args.join(" "));
      assert.equal(derlenmiş.kod, kod);
      if (kod === 0) {
        assert.equal(derlenmiş.hata, "");
        if (beklenen !== undefined) assert.equal(derlenmiş.çıktı, beklenen);
      } else {
        assert.equal(derlenmiş.çıktı, hataÖncesiÇıktı);
        assert.ok(derlenmiş.hata.length > 0);
        assert.doesNotMatch(derlenmiş.hata, /Error:|\bat .+\(.*:\d+:\d+\)/);
        if (beklenen !== undefined)
          assert.ok(
            derlenmiş.hata.includes(beklenen),
            `${args.join(" ")}: '${beklenen}' bekleniyordu; alınan tanı: ${derlenmiş.hata}`,
          );
      }
      sayı++;
    }
    karşılaştır(["sürüm"], 0, `Ata Dil ${version}\n`);
    karşılaştır(["yardım"], 0);
    const merhaba = resolve(projeKökü, "örnekler/merhaba.ata");
    karşılaştır(["denetle", merhaba], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", merhaba], 0, "Merhaba İbrahim!\nAta Dil çalışıyor.\n");
    karşılaştır(
      ["çalıştır", resolve(projeKökü, "örnekler/eşleştirme.ata")],
      0,
      "İbrahim: yönetici\n",
    );
    for (const yol of [özel, resolve(geçici, özel)]) {
      karşılaştır(["denetle", yol], 0, "Denetim başarılı.\n");
      karşılaştır(["çalıştır", yol], 0, "Türkçe: İı Şş Ğğ 🌍\n");
    }
    karşılaştır(["çalıştır", "olmayan.ata"], 1, "UTF-8");
    karşılaştır(["çalıştır", "program.txt"], 1, ".ata");
    karşılaştır(["bilinmeyen"], 1);
    karşılaştır(["çalıştır"], 1);
    karşılaştır([], 0);
    karşılaştır(["sürüm", "fazla"], 1);
    await mkdir(join(geçici, "dizin.ata"));
    await Bun.write(join(geçici, "boş.ata"), "");
    await Bun.write(join(geçici, "bozuk-utf8.ata"), new Uint8Array([0xc3, 0x28]));
    karşılaştır(["çalıştır", "dizin.ata"], 1, "UTF-8");
    karşılaştır(["çalıştır", "bozuk-utf8.ata"], 1, "UTF-8");
    karşılaştır(["denetle", "boş.ata"], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", "boş.ata"], 0, "");
    const hatalar = [
      ["ATA1001", "@"],
      ["ATA2001", "sabit ="],
      ["ATA3001", "bilinmeyen yazdır"],
      ["ATA4034", 'işlev f(): hiç { "çağrılmamalı" yazdır }; sabit x: hiç? = f(); x yazdır'],
      ["ATA5001", "1 / 0 yazdır"],
    ] as const;
    await Promise.all(hatalar.map(([kod, metin]) => Bun.write(join(geçici, `${kod}.ata`), metin)));
    for (const [kod] of hatalar) {
      karşılaştır(["çalıştır", `${kod}.ata`], 1, kod);
      if (kod === "ATA4034") karşılaştır(["denetle", `${kod}.ata`], 1, kod);
    }
    await Bun.write(
      join(geçici, "girdi.ata"),
      'sabit ad = girdi("Adınız: ")\n"Merhaba {ad}!" yazdır',
    );
    karşılaştır(["çalıştır", "girdi.ata"], 0, "Adınız: Merhaba İbrahim!\n", "İbrahim\r\n");
    karşılaştır(["çalıştır", "girdi.ata"], 0, "Adınız: Merhaba 🌍!\n", "🌍\n");
    karşılaştır(["çalıştır", "girdi.ata"], 0, "Adınız: Merhaba !\n", "\n");
    karşılaştır(["çalıştır", "girdi.ata"], 1, "ATA5007", "", "Adınız: ");
    karşılaştır(
      ["çalıştır", "girdi.ata"],
      1,
      "ATA5007",
      new Uint8Array([0xc3, 0x28, 0x0a]),
      "Adınız: ",
    );
    await Bun.write(join(geçici, "ardışık.ata"), 'girdi("") yazdır\ngirdi("") yazdır');
    karşılaştır(["çalıştır", "ardışık.ata"], 0, "İbrahim\n🌍\n", "İbrahim\r\n🌍");
    const modülGirişi = join("geçici testler", "modüller/ana.ata");
    const yardımcı = join(geçici, "geçici testler/modüller/yardımcı dosyalar/ölçüler.ata");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" kullan\nölçüler::topla(ölçüler::pi, 2) yazdır',
    );
    await Bun.write(yardımcı, "sabit pi = 3\nişlev topla(a: sayı, b: sayı): sayı { a + b döndür }");
    for (const giriş of [modülGirişi, resolve(geçici, modülGirişi)]) {
      karşılaştır(["denetle", giriş], 0, "Denetim başarılı.\n");
      karşılaştır(["çalıştır", giriş], 0, "5\n");
    }
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" mat olarak kullan\nmat::topla(mat::pi, 2) yazdır',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", modülGirişi], 0, "5\n");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" içinden pi, topla kullan\ntopla(pi, 2) yazdır',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", modülGirişi], 0, "5\n");
    for (const [gövde, kod] of [
      ['"yardımcı dosyalar/ölçüler" kullan\nölçüler::olmayan()', "ATA6004"],
      ['"yardımcı dosyalar/ölçüler" kullan\nölçüler yazdır', "ATA4035"],
      [
        '"yardımcı dosyalar/ölçüler" kullan\n"yardımcı dosyalar/./ölçüler" mat olarak kullan',
        "ATA6007",
      ],
    ] as const) {
      // eslint-disable-next-line no-await-in-loop -- Aynı entry her kaynak/binary karşılaştırmasından önce değiştirilir.
      await Bun.write(join(geçici, modülGirişi), gövde);
      karşılaştır(["çalıştır", modülGirişi], 1, kod);
    }
    await Bun.write(join(geçici, "geçici testler/modüller/foo-bar.ata"), "sabit değer = 1");
    await Bun.write(join(geçici, modülGirişi), '"foo-bar" kullan');
    karşılaştır(["denetle", modülGirişi], 1, "ATA6005");
    await Bun.write(join(geçici, modülGirişi), '"foo-bar" fb olarak kullan\nfb::değer yazdır');
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    await Bun.write(yardımcı, "yapı K { x: sayı }\nsabit kişi = K { x: 1 }");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" mat olarak kullan\nsabit k: mat::K = mat::K { x: 1 }\nk.x yazdır',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", modülGirişi], 0, "1\n");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" içinden K kullan\nsabit k: K = K { x: 1 }',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", modülGirişi], 0, "");
    await Bun.write(join(geçici, "geçici testler/modüller/durumlar.ata"), "seçenek D { a, b }");
    await Bun.write(
      join(geçici, modülGirişi),
      '"durumlar" kullan\nsabit d: durumlar::D = durumlar::D::a\nd eşleştir { durumlar::D::a ise { "a" yazdır } durumlar::D::b ise { "b" yazdır } }',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    karşılaştır(["çalıştır", modülGirişi], 0, "a\n");
    await Promise.all([
      Bun.write(
        join(geçici, "geçici testler/modüller/ortak.ata"),
        '"ortak" yazdır\ndeğişken n = 0\nişlev artır(): sayı { n += 1; n döndür }',
      ),
      Bun.write(
        join(geçici, "geçici testler/modüller/a.ata"),
        '"ortak" kullan\n"a" yazdır\nişlev çağır(): sayı { ortak::artır() döndür }',
      ),
      Bun.write(
        join(geçici, "geçici testler/modüller/b.ata"),
        '"./ortak" içinden artır kullan\n"b" yazdır\nişlev çağır(): sayı { artır() döndür }',
      ),
      Bun.write(
        join(geçici, modülGirişi),
        '"a" kullan\n"b" kullan\n"ana" yazdır\na::çağır() yazdır\nb::çağır() yazdır',
      ),
    ]);
    karşılaştır(["çalıştır", modülGirişi], 0, "ortak\na\nb\nana\n1\n2\n");
    await Bun.write(
      join(geçici, "geçici testler/modüller/hatalı.ata"),
      "// hata\nişlev böl(x: sayı): sayı { x / 0 döndür }",
    );
    await Bun.write(join(geçici, modülGirişi), '"hatalı" kullan\nhatalı::böl(1) yazdır');
    karşılaştır(["çalıştır", modülGirişi], 1, "hatalı.ata:2:28");
    await Bun.write(join(geçici, modülGirişi), '"hatalı" kullan\nhatalı::böl(1 / 0) yazdır');
    karşılaştır(["çalıştır", modülGirişi], 1, "ana.ata:2:13");
    await Bun.write(join(geçici, "geçici testler/modüller/başka.ata"), "yapı K { x: sayı }");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" kullan\n"başka" kullan\nsabit k: başka::K = ölçüler::K { x: 1 }',
    );
    karşılaştır(["denetle", modülGirişi], 1, "Tip uyuşmazlığı:");
    await Bun.write(
      join(geçici, modülGirişi),
      '"yardımcı dosyalar/ölçüler" kullan\nölçüler::kişi yazdır',
    );
    karşılaştır(["denetle", modülGirişi], 0, "Denetim başarılı.\n");
    await Bun.write(yardımcı, '// bir\n// iki\n// üç\nsabit x: sayı = "yanlış"');
    karşılaştır(["denetle", modülGirişi], 1, "ölçüler.ata:4:17");
    karşılaştır(["çalıştır", modülGirişi], 1, "ATA4001");
    await Bun.write(yardımcı, "// bir\nsabit = 1");
    karşılaştır(["denetle", modülGirişi], 1, "ölçüler.ata:2:7");
    await Bun.write(yardımcı, '"../../modüller/ana" kullan');
    karşılaştır(["denetle", modülGirişi], 1, "ATA6003");
    await Bun.write(join(geçici, modülGirişi), '"olmayan" kullan');
    // CWD ve executable dizinindeki aynı ad importer-relative missing hatasını gizleyemez.
    await Bun.write(join(geçici, "olmayan.ata"), "sabit değer = 1");
    karşılaştır(["denetle", modülGirişi], 1, "ATA6001");
    await Bun.write(
      join(geçici, "geçici testler/ortak veriler/foo-bar.ata"),
      "yapı K { n: sayı }\nseçenek D { A, B }\nişlev yenile(k: K): K { K { n: k.n + 1 } döndür }\nişlev durum(): D { D::A döndür }",
    );
    await Bun.write(
      join(geçici, modülGirişi),
      '"../ortak veriler/foo-bar" mat olarak kullan\n"../ortak veriler/./foo-bar" içinden K, D, yenile kullan\nyenile(mat::K { n: 10 }).n yazdır\nmat::durum() == D::A yazdır\nmat::durum() eşleştir { D::A ise { "aktif" yazdır } mat::D::B ise { "pasif" yazdır } }',
    );
    for (const giriş of [modülGirişi, resolve(geçici, modülGirişi)]) {
      karşılaştır(["denetle", giriş], 0, "Denetim başarılı.\n");
      karşılaştır(["çalıştır", giriş], 0, "11\ndoğru\naktif\n");
    }
    await Promise.all([
      Bun.write(join(geçici, modülGirişi), '"a/m" a olarak kullan\n"b/m" b olarak kullan'),
      Bun.write(join(geçici, "geçici testler/modüller/a/m.ata"), "// ölçü\r\n@"),
      Bun.write(join(geçici, "geçici testler/modüller/b/m.ata"), "// şĞ🌍\r\nsabit = 1"),
    ]);
    karşılaştır(["denetle", modülGirişi], 1, "a/m.ata:2:1");
    karşılaştır(["çalıştır", modülGirişi], 1, "b/m.ata:2:7");
    await Promise.all([
      Bun.write(join(geçici, modülGirişi), '"a/m" a olarak kullan\na::çağır() yazdır'),
      Bun.write(
        join(geçici, "geçici testler/modüller/a/m.ata"),
        '"../b/m" b olarak kullan\nişlev çağır(): sayı { b::böl(1) döndür }',
      ),
      Bun.write(
        join(geçici, "geçici testler/modüller/b/m.ata"),
        "// ölçü 🌍\r\nişlev böl(x: sayı): sayı { x / 0 döndür }",
      ),
    ]);
    karşılaştır(["çalıştır", modülGirişi], 1, "b/m.ata:2:28");
    await Bun.write(
      join(geçici, "geçici testler/modüller/a/m.ata"),
      '"../b/m" b olarak kullan\nişlev çağır(): sayı { b::böl(1 / 0) döndür }',
    );
    karşılaştır(["çalıştır", modülGirişi], 1, "a/m.ata:2:30");
    console.log(
      `Binary smoke başarılı: ${sayı} kaynak/binary karşılaştırması; depo dışında, PATH boş.`,
    );
  } finally {
    // mkdtemp'in bu çalıştırma için oluşturduğu tek dizin.
    await rm(geçici, { recursive: true, force: true });
  }
}

try {
  await smoke();
} catch (hata) {
  console.error(hata instanceof Error ? hata.message : "Binary smoke başarısız.");
  process.exitCode = 1;
}
