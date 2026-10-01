import type { KullanBildirimi, Program } from "../ast/düğümler.ts";
import type { Kaynak } from "../kaynak/kaynak.ts";
import type { Tanı } from "../tanılama/tanı.ts";

export interface ModülBağımlılığı {
  readonly bildirim: KullanBildirimi;
  readonly hedefYol: string;
}

export interface ModülKaydı {
  readonly kanonikYol: string;
  readonly kaynak: Kaynak;
  readonly program: Program;
  readonly bağımlılıklar: readonly ModülBağımlılığı[];
}

export interface ModülGrafiği {
  readonly giriş: ModülKaydı;
  readonly modüller: ReadonlyMap<string, ModülKaydı>;
  readonly sıra: readonly ModülKaydı[];
}

export interface ModülYüklemeSonucu {
  readonly grafik: ModülGrafiği | null;
  readonly tanılar: readonly Tanı[];
  // Parse hatası taşıyan kaynaklar da renderer için saklanır.
  readonly kaynaklar: ReadonlyMap<string, Kaynak>;
  readonly girişOkunamadı: boolean;
}
