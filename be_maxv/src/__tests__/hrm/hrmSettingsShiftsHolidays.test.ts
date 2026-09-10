import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layDanhSach11NgayLeChuan,
  layNgayLeAmLich,
} from '../../utils/cau_hinh_mac_dinh/vietnamHolidays.util';
import {
  amSangDuong,
  dinhDangIso,
  duongSangAm,
  jdTuNgayDuong,
  MUI_GIO_VN,
} from '../../utils/cau_hinh_mac_dinh/amLich.util';
import {
  BIEU_THUE_5_BAC_CU,
  BIEU_THUE_CHUAN_7_BAC,
  getSettings,
  khoiTaoCauHinhMacDinh,
  laBieuThueTrungKhop,
  restoreDefault,
  updateSettings,
} from '../../services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';
import {
  createWorkShift,
  ganThuocTinhSuyRa,
  tinhCaQuaDem,
  tinhGioCongThucTe,
} from '../../services/client/hrm/cau_hinh_mac_dinh/workShifts.service';
import { quickGenerateHolidays } from '../../services/client/hrm/cau_hinh_mac_dinh/holidays.service';
import { Prisma } from '../../generated/tenant';
import {
  chuanHoaBacMo,
  soatToanVenBieuThue,
  updateGeneralSettingsSchema,
  soatThueLuyTien,
  MOC_TUONG_THICH_BAC_MO,
  type TaxBracketItem,
} from '../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';
import {
  createWorkShiftSchema,
  updateWorkShiftSchema,
  workShiftListQuerySchema,
} from '../../validators/hrm/cau_hinh_mac_dinh/workShifts.validator';
import {
  createHolidaySchema,
  holidayListQuerySchema,
  quickGenerateHolidaySchema,
} from '../../validators/hrm/cau_hinh_mac_dinh/holidays.validator';
import { assertAdminOrOwner } from '../../routes/hrm/cau_hinh_mac_dinh/generalSettings.route';
import { MESSAGES } from '../../constants/messages';
import { HRM_CANH_BAO } from '../../constants/hrm/hrmCanhBao';
import { ForbiddenError, BadRequestError } from '../../helpers/errors';

/* ════════════════════════════════════════════════════════════════════
 * 1. Tiện ích âm lịch & 11 ngày lễ chuẩn Việt Nam (2024–2030)
 * ════════════════════════════════════════════════════════════════════ */

test('vietnamHolidays: đủ 11 ngày lễ chuẩn mỗi năm từ 2024 đến 2030 (Điều 112 BLLĐ)', () => {
  for (let y = 2024; y <= 2030; y++) {
    const holidays = layDanhSach11NgayLeChuan(y);
    assert.equal(holidays.length, 11, `Năm ${y} phải có đúng 11 ngày lễ`);
    const national = holidays.filter((h) => h.type === 'NATIONAL');
    const lunar = holidays.filter((h) => h.type === 'LUNAR');
    assert.equal(national.length, 5, `Năm ${y} phải có 5 ngày lễ dương lịch`);
    assert.equal(
      lunar.length,
      6,
      `Năm ${y} phải có 6 ngày lễ âm lịch (5 Tết + 1 Giỗ Tổ)`,
    );
    assert.ok(
      lunar.every((h) => h.isAnnual === false),
      'Lễ âm lịch phải có isAnnual = false',
    );
    assert.ok(
      national.every((h) => h.isAnnual === true),
      'Lễ dương lịch phải có isAnnual = true',
    );
  }
});

/*
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO NHÓM CA NÀY ĐƯỢC VIẾT LẠI TỪ ĐẦU (B2)
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Ca cũ neo đích danh vào bảng tra tay: `2026-02-18` là "Mùng 1", `2026-02-17` là "30 Tết". Cả
 * hai con số đó SAI, nên ca đó không kiểm chứng gì — nó BẢO VỆ CÁI SAI. Muốn phá kiểu ca như vậy
 * thì phép so phải đến từ một nguồn ĐỘC LẬP với thứ đang bị kiểm.
 *
 * Ba tầng độc lập được dùng ở đây, theo thứ tự tin cậy giảm dần:
 *
 *   1. `AC-B2-1` — neo thuật toán vào các mốc Tết QUÁ KHỨ đã xảy ra rồi. Đây là sự thật lịch sử,
 *      không rút ra từ mã nào trong kho, nên là điểm tựa duy nhất thật sự "ngoài hệ thống".
 *   2. `AC-B2-2/3/4` — bất biến của chính lịch âm (ngày tự khai đúng ngày âm của nó, 5 ngày Tết
 *      liền nhau, độ dài năm âm chỉ nhận vài giá trị). Không cần biết đáp án vẫn bắt được lệch.
 *   3. `AC-B2-5/6/7` — neo cứng ba điểm ĐÃ TỪNG SAI để việc tái phạm gây đỏ ngay lập tức.
 *
 * TUYỆT ĐỐI KHÔNG sửa nhóm ca này bằng cách chép lại kết quả hàm đang chạy. Muốn đổi số thì phải
 * đối chiếu nguồn ngoài trước.
 */

test('AC-B2-1: thuật toán âm lịch tái lập đúng các mốc Tết ĐÃ XẢY RA (nguồn ngoài hệ thống)', () => {
  // Ngày Tết Nguyên Đán các năm đã qua — sự kiện lịch sử, không suy ra từ mã nguồn nào.
  const tetDaXayRa: Array<[number, string]> = [
    [2018, '2018-02-16'],
    [2019, '2019-02-05'],
    [2020, '2020-01-25'],
    [2021, '2021-02-12'],
    [2022, '2022-02-01'],
    [2023, '2023-01-22'],
    [2024, '2024-02-10'],
    [2025, '2025-01-29'],
  ];
  for (const [nam, ngay] of tetDaXayRa) {
    const tinh = amSangDuong(1, 1, nam);
    assert.notEqual(tinh, null, `không tính được Mùng 1 Tết ${nam}`);
    assert.equal(dinhDangIso(tinh!), ngay, `Mùng 1 Tết ${nam} phải là ${ngay}`);
  }

  // Giỗ Tổ Hùng Vương các năm đã qua (10/3 âm lịch).
  const gioToDaXayRa: Array<[number, string]> = [
    [2023, '2023-04-29'],
    [2024, '2024-04-18'],
    [2025, '2025-04-07'],
  ];
  for (const [nam, ngay] of gioToDaXayRa) {
    assert.equal(
      dinhDangIso(amSangDuong(10, 3, nam)!),
      ngay,
      `Giỗ Tổ ${nam} phải là ${ngay}`,
    );
  }
});

test('AC-B2-2: 2024–2030 — mỗi ngày lễ âm lịch tự khai đúng ngày âm của chính nó', () => {
  /*
   * Ca thay cho ca "năm 2026 khớp từng ngày" cũ, và mạnh hơn hẳn: thay vì so với một bảng chép
   * tay, nó hỏi ngược thuật toán xem ngày dương ấy THẬT SỰ là mùng mấy tháng mấy âm lịch, rồi
   * đối chiếu với cái TÊN mà hệ thống gán. Bảng cũ đặt tên "30 Tết" cho một ngày vốn là Mùng 1
   * (2026) và đặt tên "30 Tết" cho ngày 29 tháng Chạp ở bốn năm liền (2027–2030) — ca này bắt
   * được cả hai loại lỗi mà không cần biết trước đáp án đúng.
   */
  for (let y = 2024; y <= 2030; y++) {
    const am = layNgayLeAmLich(y);
    assert.equal(am.length, 6, `năm ${y} phải có 6 ngày lễ âm lịch`);

    for (const muc of am) {
      const [nam, thang, ngay] = muc.date.split('-').map(Number);
      const al = duongSangAm(ngay, thang, nam);

      if (muc.name.startsWith('Tết Nguyên Đán')) {
        const mung = Number(/Mùng (\d)/.exec(muc.name)![1]);
        assert.equal(
          al.thang,
          1,
          `${muc.date} (${muc.name}) phải nằm trong tháng Giêng âm`,
        );
        assert.equal(
          al.ngay,
          mung,
          `${muc.date} tự xưng ${muc.name} nhưng là ${al.ngay}/${al.thang} âm`,
        );
        assert.equal(
          al.nhuan,
          false,
          'tháng Giêng không bao giờ là tháng nhuận',
        );
      } else if (muc.name.startsWith('Nghỉ Tết Âm lịch')) {
        const soTet = Number(/\((\d+) Tết\)/.exec(muc.name)![1]);
        assert.equal(
          al.thang,
          12,
          `${muc.date} (${muc.name}) phải nằm trong tháng Chạp`,
        );
        assert.equal(
          al.ngay,
          soTet,
          `${muc.date} tự xưng "${soTet} Tết" nhưng là ${al.ngay}/12 âm`,
        );
        assert.ok(
          soTet >= 28 && soTet <= 30,
          `"${soTet} Tết" không phải ngày cuối tháng Chạp`,
        );
      } else {
        assert.equal(
          al.ngay,
          10,
          `Giỗ Tổ ${y} phải rơi vào mùng 10 âm, đang là ${al.ngay}`,
        );
        assert.equal(
          al.thang,
          3,
          `Giỗ Tổ ${y} phải rơi vào tháng 3 âm, đang là tháng ${al.thang}`,
        );
        assert.equal(
          al.nhuan,
          false,
          'Giỗ Tổ tính theo tháng 3 THƯỜNG, không phải tháng 3 nhuận',
        );
      }
    }
  }
});

test('AC-B2-3: 5 ngày Tết là 5 ngày dương LIỀN NHAU, Mùng 1 đứng đúng vị trí thứ ba', () => {
  for (let y = 2024; y <= 2030; y++) {
    const tet = layNgayLeAmLich(y)
      .filter((x) => x.name.includes('Tết'))
      .map((x) => x.date)
      .sort((a, b) => a.localeCompare(b));
    assert.equal(tet.length, 5, `năm ${y} phải có đúng 5 ngày Tết`);

    const jd = tet.map((d) => {
      const [nam, thang, ngay] = d.split('-').map(Number);
      return jdTuNgayDuong(ngay, thang, nam);
    });
    for (let i = 1; i < jd.length; i++) {
      assert.equal(
        jd[i] - jd[i - 1],
        1,
        `năm ${y}: ${tet[i - 1]} và ${tet[i]} không liền nhau`,
      );
    }
    // Quy ước đang áp: 2 ngày cuối tháng Chạp đứng trước Mùng 1.
    assert.equal(
      dinhDangIso(amSangDuong(1, 1, y)!),
      tet[2],
      `năm ${y}: Mùng 1 sai vị trí`,
    );
  }
});

test('AC-B2-4: khoảng cách giữa hai cái Tết liên tiếp chỉ nhận độ dài năm âm hợp lệ', () => {
  /*
   * Năm âm thường 353–355 ngày, năm nhuận 383–385 ngày. Giá trị khác nghĩa là ít nhất một trong
   * hai mốc bị lệch. Chính bất biến này chứng minh 2026 sai: bảng cũ cho 2025-01-29 → 2026-02-18
   * là 385 ngày, mà năm Ất Tỵ nhuận tháng 6 chỉ dài 384 ngày.
   */
  const HOP_LE = new Set([353, 354, 355, 383, 384, 385]);
  for (let y = 2024; y <= 2030; y++) {
    const a = amSangDuong(1, 1, y)!;
    const b = amSangDuong(1, 1, y + 1)!;
    const doDai =
      jdTuNgayDuong(b[0], b[1], b[2]) - jdTuNgayDuong(a[0], a[1], a[2]);
    assert.ok(
      HOP_LE.has(doDai),
      `năm âm ${y}→${y + 1} dài ${doDai} ngày — không phải độ dài năm âm hợp lệ`,
    );
  }
  // Neo cụ thể: Ất Tỵ (2025) nhuận tháng 6 nên dài đúng 384 ngày.
  const t2025 = amSangDuong(1, 1, 2025)!;
  const t2026 = amSangDuong(1, 1, 2026)!;
  assert.equal(
    jdTuNgayDuong(t2026[0], t2026[1], t2026[2]) -
      jdTuNgayDuong(t2025[0], t2025[1], t2025[2]),
    384,
  );
});

test('AC-B2-5: BUG ĐÃ SỬA — Tết 2026 là 17/02 chứ không phải 18/02, kèm tên đúng từng ngày', () => {
  const h = layDanhSach11NgayLeChuan(2026);
  const ten = (d: string) => h.find((x) => x.date === d)?.name;

  assert.equal(ten('2026-02-15'), 'Nghỉ Tết Âm lịch (28 Tết)');
  assert.equal(ten('2026-02-16'), 'Nghỉ Tết Âm lịch (29 Tết)');
  assert.equal(ten('2026-02-17'), 'Tết Nguyên Đán (Mùng 1)');
  assert.equal(ten('2026-02-18'), 'Tết Nguyên Đán (Mùng 2)');
  assert.equal(ten('2026-02-19'), 'Tết Nguyên Đán (Mùng 3)');
  assert.equal(ten('2026-04-26'), 'Giỗ Tổ Hùng Vương (10/3 Âm lịch)');

  // Tháng Chạp Ất Tỵ chỉ có 29 ngày -> KHÔNG tồn tại ngày 30 Tết trước Tết 2026.
  assert.ok(
    !h.some((x) => x.name.includes('30 Tết')),
    'năm 2026 không có ngày 30 Tết',
  );
  // Bộ số cũ (20/02 là Mùng 3) phải biến mất hoàn toàn.
  assert.equal(
    ten('2026-02-20'),
    undefined,
    'ngày 20/02/2026 không còn là ngày lễ',
  );

  assert.equal(ten('2026-01-01'), 'Tết Dương lịch');
  assert.equal(ten('2026-04-30'), 'Ngày Giải phóng miền Nam');
  assert.equal(ten('2026-05-01'), 'Ngày Quốc tế Lao động');
  assert.equal(ten('2026-09-01'), 'Nghỉ liền kề Quốc khánh');
  assert.equal(ten('2026-09-02'), 'Ngày Quốc khánh');
});

test('AC-B2-6: BUG ĐÃ SỬA — Tết 2030 theo lịch VIỆT NAM (UTC+7) là 02/02, không lấy số của lịch TQ', () => {
  /*
   * Điểm lệch mà bản review KHÔNG bắt được, vì cả hai bảng chép tay (máy chủ và giao diện) đều
   * ghi cùng một con số sai nên đối chiếu chéo hai bảng không thấy gì. Sóc mở đầu tháng Giêng
   * 2030 rơi vào 02/02/2030 lúc 23:08 GIỜ VIỆT NAM — tức đã sang 00:08 ngày 03/02 giờ Bắc Kinh.
   * Lịch Việt Nam quy chiếu UTC+7 nên Mùng 1 là 02/02; 03/02 là ngày Tết của lịch Trung Quốc.
   */
  assert.equal(
    dinhDangIso(amSangDuong(1, 1, 2030, false, MUI_GIO_VN)!),
    '2030-02-02',
  );
  assert.equal(dinhDangIso(amSangDuong(1, 1, 2030, false, 8)!), '2030-02-03');
  assert.notEqual(
    dinhDangIso(amSangDuong(1, 1, 2030, false, MUI_GIO_VN)!),
    dinhDangIso(amSangDuong(1, 1, 2030, false, 8)!),
    'hai múi giờ cho cùng kết quả thì phép kiểm này mất ý nghĩa — xem lại thuật toán',
  );

  const h = layDanhSach11NgayLeChuan(2030);
  assert.ok(
    h.some(
      (x) => x.date === '2030-02-02' && x.name === 'Tết Nguyên Đán (Mùng 1)',
    ),
  );
  assert.ok(
    !h.some((x) => x.date === '2030-02-05'),
    'ngày 05/02/2030 không còn là ngày lễ',
  );
  assert.ok(
    !h.some((x) => x.name.includes('30 Tết')),
    'năm 2030 không có ngày 30 Tết',
  );
});

test('AC-B2-7: BUG ĐÃ SỬA — Giỗ Tổ 2028 là 04/04 chứ không phải 05/04', () => {
  assert.equal(dinhDangIso(amSangDuong(10, 3, 2028)!), '2028-04-04');
  assert.ok(
    layDanhSach11NgayLeChuan(2028).some(
      (x) =>
        x.date === '2028-04-04' &&
        x.name === 'Giỗ Tổ Hùng Vương (10/3 Âm lịch)',
    ),
  );
});

test('AC-B2-8: chuyển đổi âm ↔ dương khứ hồi không mất mát', () => {
  for (let y = 2020; y <= 2035; y++) {
    for (const [ngayAm, thangAm] of [
      [1, 1],
      [10, 3],
      [15, 8],
      [1, 12],
    ]) {
      const duong = amSangDuong(ngayAm, thangAm, y);
      assert.notEqual(
        duong,
        null,
        `${ngayAm}/${thangAm} âm năm ${y} phải quy được ra dương lịch`,
      );
      const ve = duongSangAm(duong![0], duong![1], duong![2]);
      assert.deepEqual(
        { ngay: ve.ngay, thang: ve.thang, nam: ve.nam },
        { ngay: ngayAm, thang: thangAm, nam: y },
        `khứ hồi hỏng ở ${ngayAm}/${thangAm} âm năm ${y} (dương: ${dinhDangIso(duong!)})`,
      );
    }
  }
});

test('TD-HRM-01: trần 2030 chỉ còn là luật NGHIỆP VỤ, không còn là giới hạn kỹ thuật', () => {
  /*
   * Bảng tra tay cũ hết dữ liệu ở 2030 nên `layDanhSach11NgayLeChuan(2031)` trả rỗng — trần 2030
   * khi đó vừa là luật nghiệp vụ VỪA là giới hạn kỹ thuật. Sau đợt `B2`, thuật toán âm lịch tính
   * được mọi năm; trần 2030 chỉ còn là **luật nghiệp vụ** (`BR-hrm-079` / `E-hrm-079`), do
   * validator + service canh, không còn do bảng dữ liệu quyết định.
   */
  assert.equal(layDanhSach11NgayLeChuan(2031).length, 11);
  assert.equal(layDanhSach11NgayLeChuan(2023).length, 11);
  // Xa hơn nữa: những năm chắc chắn không bảng tra tay nào chép tới.
  for (const y of [2035, 2040, 2050, 2099]) {
    assert.equal(
      layDanhSach11NgayLeChuan(y).length,
      11,
      `năm ${y} phải ra đủ 11 ngày lễ`,
    );
  }
  // Tết 2023 (22/01) và Tết 2031 (23/01) — hai mốc ngoài dải nghiệp vụ, vẫn tính đúng.
  assert.ok(layNgayLeAmLich(2023).some((x) => x.date === '2023-01-22'));
  assert.ok(layNgayLeAmLich(2031).some((x) => x.date === '2031-01-23'));

  // Chặn KỸ THUẬT của thuật toán vẫn còn, và trả rỗng chứ không ném lỗi.
  assert.equal(layDanhSach11NgayLeChuan(1899).length, 0);
  assert.equal(layDanhSach11NgayLeChuan(2200).length, 0);
  assert.equal(layDanhSach11NgayLeChuan(2026.5).length, 0);
});

/* ════════════════════════════════════════════════════════════════════
 * 2. Cấu hình mặc định (GeneralSetting)
 * ════════════════════════════════════════════════════════════════════ */

test('khoiTaoCauHinhMacDinh: các tham số pháp luật Việt Nam 2024 chuẩn xác', () => {
  const def = khoiTaoCauHinhMacDinh();
  assert.equal(def.baseSalary, 2340000); // NĐ 73/2024
  assert.equal(def.regionMinSalary, 4960000); // NĐ 74/2024
  assert.equal(def.personalDeduction, 11000000); // NQ 954/2020
  assert.equal(def.dependentDeduction, 4400000);
  assert.equal(def.standardHoursPerDay, 8.0);
  assert.equal(def.insuranceEmployeeSocial, 8.0);
  assert.equal(def.insuranceCompanySocial, 17.5);
});

test('AC-hrm-67: biểu thuế mặc định là ĐÚNG 7 bậc Điều 22, trần 35%, bậc cuối là bậc mở', () => {
  const bieu = khoiTaoCauHinhMacDinh().taxBrackets;

  assert.equal(
    bieu.length,
    7,
    'Biểu 5 bậc cắt cụt ở 25% là SAI LUẬT (BR-hrm-081)',
  );
  assert.deepEqual(bieu, [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 10000000, thueSuat: 10 },
    { khoang: 18000000, thueSuat: 15 },
    { khoang: 32000000, thueSuat: 20 },
    { khoang: 52000000, thueSuat: 25 },
    { khoang: 80000000, thueSuat: 30 },
    { khoang: null, thueSuat: 35 },
  ]);

  // Bậc mở mã hóa bằng `null`, TUYỆT ĐỐI không phải mốc 999999999999 (ADR-009 QĐ 1).
  assert.equal(bieu[6].khoang, null);
  assert.ok(!bieu.some((b) => b.khoang === MOC_TUONG_THICH_BAC_MO));
  assert.equal(Math.max(...bieu.map((b) => b.thueSuat)), 35);

  // Bộ mặc định phải là BẢN SAO: sửa nó không được làm bẩn hằng dùng chung.
  bieu[0].thueSuat = 99;
  assert.equal(BIEU_THUE_CHUAN_7_BAC[0].thueSuat, 5);
});

test('AC-hrm-67: biểu mặc định tự thỏa đủ 4 điều kiện toàn vẹn của BR-hrm-082', () => {
  assert.equal(soatToanVenBieuThue(BIEU_THUE_CHUAN_7_BAC), null);
  assert.ok(
    updateGeneralSettingsSchema.safeParse({
      taxBrackets: BIEU_THUE_CHUAN_7_BAC,
    }).success,
  );
});

test('BR-hrm-082 đk 1 (E-hrm-081): biểu rỗng hoặc 1 bậc bị từ chối', () => {
  assert.equal(soatToanVenBieuThue([]), MESSAGES.HRM.BIEU_THUE_TOI_THIEU_2_BAC);
  assert.equal(
    soatToanVenBieuThue([{ khoang: null, thueSuat: 10 }]),
    MESSAGES.HRM.BIEU_THUE_TOI_THIEU_2_BAC,
  );

  const rRong = updateGeneralSettingsSchema.safeParse({ taxBrackets: [] });
  assert.ok(!rRong.success);
  assert.ok(
    rRong.error.issues.some(
      (i) => i.message === MESSAGES.HRM.BIEU_THUE_TOI_THIEU_2_BAC,
    ),
  );

  const rMot = updateGeneralSettingsSchema.safeParse({
    taxBrackets: [{ khoang: null, thueSuat: 10 }],
  });
  assert.ok(!rMot.success);
  assert.ok(
    rMot.error.issues.some(
      (i) => i.message === MESSAGES.HRM.BIEU_THUE_TOI_THIEU_2_BAC,
    ),
  );
});

test('AC-hrm-68 / BR-hrm-082 đk 2 (E-hrm-080): ngưỡng lũy kế phải tăng nghiêm ngặt', () => {
  // Bậc 2 là 10tr, bậc 3 là 8tr — thuế suất vẫn tăng đều 5/10/15/20. Trước QĐ #25 nội dung này
  // được CHẤP NHẬN vì chỉ cột thuế suất được kiểm.
  const lonXon: TaxBracketItem[] = [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 10000000, thueSuat: 10 },
    { khoang: 8000000, thueSuat: 15 },
    { khoang: null, thueSuat: 20 },
  ];
  assert.ok(
    soatThueLuyTien(lonXon),
    'cột thuế suất vẫn hợp lệ — đó là cái bẫy',
  );
  assert.equal(
    soatToanVenBieuThue(lonXon),
    MESSAGES.HRM.NGUONG_THUE_KHONG_TANG,
  );

  const r = updateGeneralSettingsSchema.safeParse({ taxBrackets: lonXon });
  assert.ok(!r.success);
  assert.ok(
    r.error.issues.some(
      (i) => i.message === MESSAGES.HRM.NGUONG_THUE_KHONG_TANG,
    ),
  );

  // Ngưỡng giảm hẳn từ bậc 1 sang bậc 2 (ca đối soát của Architect) cũng phải bị chặn.
  assert.equal(
    soatToanVenBieuThue([
      { khoang: 32000000, thueSuat: 5 },
      { khoang: 5000000, thueSuat: 10 },
      { khoang: null, thueSuat: 15 },
    ]),
    MESSAGES.HRM.NGUONG_THUE_KHONG_TANG,
  );

  // Ngưỡng BẰNG NHAU cũng là vi phạm (tăng "nghiêm ngặt", không phải "không giảm").
  assert.equal(
    soatToanVenBieuThue([
      { khoang: 5000000, thueSuat: 5 },
      { khoang: 5000000, thueSuat: 10 },
      { khoang: null, thueSuat: 15 },
    ]),
    MESSAGES.HRM.NGUONG_THUE_KHONG_TANG,
  );
});

test('AC-hrm-69 / BR-hrm-082 đk 4 (E-hrm-082): bậc cuối phải là bậc mở', () => {
  // Biểu 7 bậc nhưng bậc cuối có trần hữu hạn 100tr ⇒ thu nhập trên 100tr không có bậc nào áp.
  const cuoiHuuHan: TaxBracketItem[] = [
    ...BIEU_THUE_CHUAN_7_BAC.slice(0, 6),
    { khoang: 100000000, thueSuat: 35 },
  ];
  assert.equal(
    soatToanVenBieuThue(cuoiHuuHan),
    MESSAGES.HRM.BAC_THUE_CUOI_PHAI_MO,
  );

  const r = updateGeneralSettingsSchema.safeParse({ taxBrackets: cuoiHuuHan });
  assert.ok(!r.success);
  assert.ok(
    r.error.issues.some(
      (i) => i.message === MESSAGES.HRM.BAC_THUE_CUOI_PHAI_MO,
    ),
  );

  // `null` ở vị trí KHÔNG phải cuối cũng là vi phạm cùng mã.
  assert.equal(
    soatToanVenBieuThue([
      { khoang: null, thueSuat: 5 },
      { khoang: 10000000, thueSuat: 10 },
      { khoang: null, thueSuat: 15 },
    ]),
    MESSAGES.HRM.BAC_THUE_CUOI_PHAI_MO,
  );
});

test('BR-hrm-082 đk 3 (E-hrm-069): thuế suất phải tăng nghiêm ngặt', () => {
  assert.equal(
    soatToanVenBieuThue([
      { khoang: 5000000, thueSuat: 10 },
      { khoang: 10000000, thueSuat: 10 },
      { khoang: null, thueSuat: 15 },
    ]),
    MESSAGES.HRM.THUE_TNCN_KHONG_LUY_TIEN,
  );
});

test('BR-hrm-080: giá trị 0 KHÔNG mang nghĩa bậc cuối, luôn bị từ chối', () => {
  const r = updateGeneralSettingsSchema.safeParse({
    taxBrackets: [
      { khoang: 5000000, thueSuat: 5 },
      { khoang: 0, thueSuat: 10 },
    ],
  });
  assert.ok(!r.success);
});

test('ADR-009 QĐ 1 quy tắc 4: mốc 999999999999 ở bậc CUỐI được chuẩn hóa về null', () => {
  const bieuCu: TaxBracketItem[] = [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 10000000, thueSuat: 10 },
    { khoang: MOC_TUONG_THICH_BAC_MO, thueSuat: 25 },
  ];
  assert.equal(chuanHoaBacMo(bieuCu)[2].khoang, null);
  // Hàm chuẩn hóa KHÔNG được sửa mảng gốc tại chỗ.
  assert.equal(bieuCu[2].khoang, MOC_TUONG_THICH_BAC_MO);

  // Payload cũ đi qua schema phải lưu được VÀ ra `null`, không phải 400 E-hrm-082.
  const r = updateGeneralSettingsSchema.safeParse({ taxBrackets: bieuCu });
  assert.ok(r.success);
  assert.equal(r.data.taxBrackets?.[2].khoang, null);

  // Mốc ở vị trí KHÔNG phải cuối vẫn là một ngưỡng hữu hạn bình thường -> không đụng tới.
  const mocOGiua: TaxBracketItem[] = [
    { khoang: MOC_TUONG_THICH_BAC_MO, thueSuat: 5 },
    { khoang: null, thueSuat: 10 },
  ];
  assert.equal(chuanHoaBacMo(mocOGiua)[0].khoang, MOC_TUONG_THICH_BAC_MO);
});

test('AC-hrm-70 / BR-hrm-083: nhận diện biểu lệch chuẩn để sinh cảnh báo', () => {
  assert.ok(laBieuThueTrungKhop(BIEU_THUE_CHUAN_7_BAC, BIEU_THUE_CHUAN_7_BAC));

  // Biểu 5 bậc lệch chuẩn của AC-hrm-70 (5% · 15% · 25% · 30% · 35%) — hợp lệ về cấu trúc.
  const lechChuan: TaxBracketItem[] = [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 18000000, thueSuat: 15 },
    { khoang: 52000000, thueSuat: 25 },
    { khoang: 80000000, thueSuat: 30 },
    { khoang: null, thueSuat: 35 },
  ];
  assert.equal(
    soatToanVenBieuThue(lechChuan),
    null,
    'lệch chuẩn vẫn phải LƯU ĐƯỢC',
  );
  assert.ok(!laBieuThueTrungKhop(lechChuan, BIEU_THUE_CHUAN_7_BAC));

  // Chỉ lệch đúng MỘT ngưỡng cũng là lệch chuẩn.
  const lechMotO = BIEU_THUE_CHUAN_7_BAC.map((b, i) =>
    i === 2 ? { ...b, khoang: 20000000 } : { ...b },
  );
  assert.ok(!laBieuThueTrungKhop(lechMotO, BIEU_THUE_CHUAN_7_BAC));

  assert.equal(
    HRM_CANH_BAO.BIEU_THUE_LECH_CHUAN,
    'CANH_BAO_BIEU_THUE_LECH_CHUAN',
  );
});

test('FR-hrm-055: chỉ biểu 5 bậc cũ TRÙNG KHỚP NGUYÊN VĂN mới được ghi đè', () => {
  // Đúng nguyên văn bản hệ thống tự nạp sai (bậc cuối là mốc số) -> được chuẩn hóa.
  assert.ok(laBieuThueTrungKhop(BIEU_THUE_5_BAC_CU, BIEU_THUE_5_BAC_CU));
  assert.equal(BIEU_THUE_5_BAC_CU.length, 5);
  assert.equal(BIEU_THUE_5_BAC_CU[4].khoang, MOC_TUONG_THICH_BAC_MO);
  assert.equal(BIEU_THUE_5_BAC_CU[4].thueSuat, 25);

  // Công ty đã tự sửa (dù chỉ một ô) -> KHÔNG được coi là biểu cũ, phải giữ nguyên.
  const daSuaTay = BIEU_THUE_5_BAC_CU.map((b, i) =>
    i === 3 ? { ...b, khoang: 30000000 } : { ...b },
  );
  assert.ok(!laBieuThueTrungKhop(daSuaTay, BIEU_THUE_5_BAC_CU));

  // Biểu 5 bậc mà bậc cuối đã là `null` là LỰA CHỌN của người dùng -> không phải biểu cũ.
  const namBacBacMo = BIEU_THUE_5_BAC_CU.map((b, i) =>
    i === 4 ? { ...b, khoang: null } : { ...b },
  );
  assert.ok(!laBieuThueTrungKhop(namBacBacMo, BIEU_THUE_5_BAC_CU));

  // Biểu chuẩn 7 bậc không bao giờ bị nhầm là biểu cũ (bảo đảm chạy lại cho cùng kết quả).
  assert.ok(!laBieuThueTrungKhop(BIEU_THUE_CHUAN_7_BAC, BIEU_THUE_5_BAC_CU));

  // Dữ liệu méo mó đọc từ cột Json không được làm hàm nổ, và luôn coi là KHÔNG trùng khớp.
  assert.ok(!laBieuThueTrungKhop(null, BIEU_THUE_5_BAC_CU));
  assert.ok(!laBieuThueTrungKhop('[]', BIEU_THUE_5_BAC_CU));
  assert.ok(
    !laBieuThueTrungKhop([null, null, null, null, null], BIEU_THUE_5_BAC_CU),
  );
});

test('updateGeneralSettingsSchema: giờ công chuẩn ngoài 1.0-24.0 -> E-hrm-067 (TC-hrm-277)', () => {
  const r09 = updateGeneralSettingsSchema.safeParse({
    standardHoursPerDay: 0.9,
  });
  assert.ok(!r09.success);
  assert.ok(
    r09.error.issues.some(
      (i) => i.message === MESSAGES.HRM.GIO_CONG_CHUAN_INVALID,
    ),
  );

  const r241 = updateGeneralSettingsSchema.safeParse({
    standardHoursPerDay: 24.1,
  });
  assert.ok(!r241.success);
  assert.ok(
    r241.error.issues.some(
      (i) => i.message === MESSAGES.HRM.GIO_CONG_CHUAN_INVALID,
    ),
  );

  const rOk = updateGeneralSettingsSchema.safeParse({
    standardHoursPerDay: 8.0,
  });
  assert.ok(rOk.success);

  const rFixed24 = updateGeneralSettingsSchema.safeParse({
    standardWorkingDaysMethod: 'FIXED_24',
  });
  assert.ok(rFixed24.success);
});

test('updateGeneralSettingsSchema: lương cơ sở / tối thiểu vùng <= 0 -> E-hrm-068', () => {
  const rSalary0 = updateGeneralSettingsSchema.safeParse({ baseSalary: 0 });
  assert.ok(!rSalary0.success);
  assert.ok(
    rSalary0.error.issues.some(
      (i) => i.message === MESSAGES.HRM.LUONG_CO_SO_HOAC_VUNG_INVALID,
    ),
  );

  const rRegNeg = updateGeneralSettingsSchema.safeParse({
    regionMinSalary: -500,
  });
  assert.ok(!rRegNeg.success);
  assert.ok(
    rRegNeg.error.issues.some(
      (i) => i.message === MESSAGES.HRM.LUONG_CO_SO_HOAC_VUNG_INVALID,
    ),
  );
});

test('updateGeneralSettingsSchema: thuế lũy tiến vi phạm tăng dần -> E-hrm-069', () => {
  assert.ok(
    soatThueLuyTien([
      { khoang: 5000000, thueSuat: 5 },
      { khoang: 10000000, thueSuat: 10 },
    ]),
  );
  assert.ok(
    !soatThueLuyTien([
      { khoang: 5000000, thueSuat: 10 },
      { khoang: 10000000, thueSuat: 5 },
    ]),
  );

  const rTaxErr = updateGeneralSettingsSchema.safeParse({
    taxBrackets: [
      { khoang: 5000000, thueSuat: 10 },
      { khoang: 10000000, thueSuat: 10 },
    ],
  });
  assert.ok(!rTaxErr.success);
  assert.ok(
    rTaxErr.error.issues.some(
      (i) => i.message === MESSAGES.HRM.THUE_TNCN_KHONG_LUY_TIEN,
    ),
  );
});

/* ════════════════════════════════════════════════════════════════════
 * 3. Ca làm việc (WorkShift)
 * ════════════════════════════════════════════════════════════════════ */

test('tinhCaQuaDem & tinhGioCongThucTe: ca ngày vs ca qua đêm', () => {
  // Ca ngày 08:00 - 17:00, nghỉ 60p -> 8h, không qua đêm
  assert.equal(tinhCaQuaDem('08:00', '17:00'), false);
  assert.equal(tinhGioCongThucTe('08:00', '17:00', 60), 8.0);

  // Ca đêm 22:00 - 06:00, nghỉ 30p -> 7.5h, có qua đêm
  assert.equal(tinhCaQuaDem('22:00', '06:00'), true);
  assert.equal(tinhGioCongThucTe('22:00', '06:00', 30), 7.5);

  // Nghỉ quá dài khiến giờ công <= 0 -> ném E-hrm-072
  assert.throws(
    () => tinhGioCongThucTe('08:00', '12:00', 240),
    (err: any) =>
      err instanceof BadRequestError &&
      err.message === MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID,
  );
});

test('AC-hrm-63 / ADR-009 QĐ 4: ca > 12h kèm warning, ca <= 12h KHÔNG có trường warning', () => {
  // Ca 24h 08:00 -> 08:00 nghỉ 120 phút = 22.0h (ví dụ đích danh trong ADR-009).
  const caDai = ganThuocTinhSuyRa({
    startTime: '08:00',
    endTime: '08:00',
    breakMinutes: 120,
  });
  assert.equal(caDai.workingHours, 22.0);
  assert.equal(caDai.isOvernight, true);
  assert.equal(caDai.warning, HRM_CANH_BAO.GIO_LAM_VUOT_TRAN_BLLD);
  assert.equal(caDai.warning, 'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD');

  // Ca 08:00 -> 17:00 nghỉ 60 phút = 8.0h: trường `warning` phải VẮNG MẶT hẳn,
  // không phải `null`, không phải chuỗi rỗng.
  const caThuong = ganThuocTinhSuyRa({
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
  });
  assert.equal(caThuong.workingHours, 8.0);
  assert.ok(!('warning' in caThuong));

  // Đúng 12.0h là biên KHÔNG cảnh báo (ngưỡng là `> 12.0`, không phải `>=`).
  const caBien = ganThuocTinhSuyRa({
    startTime: '08:00',
    endTime: '20:00',
    breakMinutes: 0,
  });
  assert.equal(caBien.workingHours, 12.0);
  assert.ok(!('warning' in caBien));

  // 12.01h là đã vượt.
  const caVuotSatBien = ganThuocTinhSuyRa({
    startTime: '08:00',
    endTime: '20:01',
    breakMinutes: 0,
  });
  assert.ok(caVuotSatBien.workingHours > 12.0);
  assert.equal(caVuotSatBien.warning, HRM_CANH_BAO.GIO_LAM_VUOT_TRAN_BLLD);
});

test('createWorkShiftSchema: kiểm tra validation E-hrm-070, E-hrm-071, E-hrm-072', () => {
  // Thiếu tên ca -> E-hrm-070
  const rEmptyName = createWorkShiftSchema.safeParse({
    name: '   ',
    startTime: '08:00',
    endTime: '17:00',
  });
  assert.ok(!rEmptyName.success);
  assert.ok(
    rEmptyName.error.issues.some(
      (i) => i.message === MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY,
    ),
  );

  // Giờ vào/ra không đúng định dạng -> E-hrm-071
  const rBadTime = createWorkShiftSchema.safeParse({
    name: 'Ca 1',
    startTime: '8:00',
    endTime: '17:00',
  });
  assert.ok(!rBadTime.success);
  assert.ok(
    rBadTime.error.issues.some(
      (i) => i.message === MESSAGES.HRM.GIO_VAO_RA_INVALID,
    ),
  );

  // Giờ công sau trừ nghỉ <= 0 -> E-hrm-072
  const rZeroHours = createWorkShiftSchema.safeParse({
    name: 'Ca 1',
    startTime: '08:00',
    endTime: '12:00',
    breakMinutes: 240,
  });
  assert.ok(!rZeroHours.success);
  assert.ok(
    rZeroHours.error.issues.some(
      (i) => i.message === MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID,
    ),
  );
});

/* ════════════════════════════════════════════════════════════════════
 * 4. Lịch ngày lễ (Holiday)
 * ════════════════════════════════════════════════════════════════════ */

test('createHolidaySchema: tên/ngày bắt buộc E-hrm-074, cấm âm lịch lặp hàng năm E-hrm-075', () => {
  const rNoName = createHolidaySchema.safeParse({
    date: '2026-01-01',
    name: '',
  });
  assert.ok(!rNoName.success);
  assert.ok(
    rNoName.error.issues.some(
      (i) => i.message === MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY,
    ),
  );

  const rLunarAnnual = createHolidaySchema.safeParse({
    date: '2026-02-18',
    name: 'Tết Mùng 1',
    type: 'LUNAR',
    isAnnual: true,
  });
  assert.ok(!rLunarAnnual.success);
  assert.ok(
    rLunarAnnual.error.issues.some(
      (i) => i.message === MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI,
    ),
  );

  // COMPENSATORY với isAnnual = true cũng bị chặn E-hrm-075
  const rCompAnnual = createHolidaySchema.safeParse({
    date: '2026-05-02',
    name: 'Nghỉ bù 30/4',
    type: 'COMPENSATORY',
    isAnnual: true,
  });
  assert.ok(!rCompAnnual.success);
  assert.ok(
    rCompAnnual.error.issues.some(
      (i) => i.message === MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI,
    ),
  );

  // COMPENSATORY với isAnnual = false thì pass
  const rCompOk = createHolidaySchema.safeParse({
    date: '2026-05-02',
    name: 'Nghỉ bù 30/4',
    type: 'COMPENSATORY',
    isAnnual: false,
  });
  assert.ok(rCompOk.success);
});

test('BE-03: ?isPaid=false lọc ĐÚNG nhóm không hưởng lương, không phải nhóm ngược lại', () => {
  // Bản cũ dùng `z.coerce.boolean()`: `Boolean("false") === true` nên `?isPaid=false` trả về
  // đúng nhóm CÓ hưởng lương — sai ngược và im lặng.
  const rFalse = holidayListQuerySchema.parse({ isPaid: 'false' });
  assert.equal(rFalse.isPaid, false);

  const rTrue = holidayListQuerySchema.parse({ isPaid: 'true' });
  assert.equal(rTrue.isPaid, true);

  // Không truyền -> không lọc theo isPaid.
  const rVang = holidayListQuerySchema.parse({});
  assert.equal(rVang.isPaid, undefined);

  // Giá trị lạ phải BÁO LỖI thay vì đoán bừa (đây là cả điểm của BE-03).
  assert.ok(!holidayListQuerySchema.safeParse({ isPaid: 'khong' }).success);
  assert.ok(!holidayListQuerySchema.safeParse({ isPaid: '' }).success);
  assert.ok(!holidayListQuerySchema.safeParse({ isPaid: '0' }).success);
});

test('N3: ?year vô lý bị chặn ở Zod (400), không lọt xuống Prisma thành Invalid Date rồi 500', () => {
  /*
   * `year` đi thẳng vào `new Date(\`${year}-01-01T00:00:00.000Z\`)` trong service. Với `year` là
   * 1 / 0 / -1 / 99999 thì đó là `Invalid Date`, và một `Invalid Date` đưa vào `where.date.gte`
   * làm Prisma vỡ — người dùng nhận **500** cho một lỗi vốn thuộc về ĐẦU VÀO và phải là **400**.
   */
  for (const nam of [1, 0, -1, 99999, 1899, 2101, -2026]) {
    const r = holidayListQuerySchema.safeParse({ year: nam });
    assert.ok(!r.success, `year=${nam} phải bị Zod từ chối`);
  }

  // Mọi năm còn lọt qua đều phải dựng được `Date` hợp lệ — đây mới là điều kiện thật sự cần.
  for (const nam of [1900, 1975, 2024, 2026, 2031, 2100]) {
    const r = holidayListQuerySchema.safeParse({ year: nam });
    assert.ok(r.success, `year=${nam} phải hợp lệ`);
    const d = new Date(`${r.success ? r.data.year : ''}-01-01T00:00:00.000Z`);
    assert.ok(!Number.isNaN(d.getTime()), `year=${nam} tạo ra Invalid Date`);
  }

  /*
   * Dải NGHIỆP VỤ 2024–2030 chỉ áp cho "Tạo nhanh", KHÔNG áp cho việc xem danh sách: người dùng
   * phải tra được lịch của năm bất kỳ trong dải kỹ thuật 1900–2100.
   */
  assert.ok(holidayListQuerySchema.safeParse({ year: 2023 }).success);
  assert.ok(holidayListQuerySchema.safeParse({ year: 2031 }).success);
  assert.ok(!quickGenerateHolidaySchema.safeParse({ year: 2031 }).success);
});

test('quickGenerateHolidaySchema: năm ngoài 2024-2030 -> E-hrm-079', () => {
  const thongDiep = MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID;

  // ── Ngoài dải: sát biên hai phía, và hai giá trị vô lý ──
  for (const nam of [2023, 2031, 1999, 9999]) {
    const r = quickGenerateHolidaySchema.safeParse({ year: nam });
    assert.ok(!r.success, `năm ${nam} phải bị từ chối`);
    assert.ok(
      r.error.issues.some((i) => i.message === thongDiep),
      `năm ${nam} phải trả đúng câu E-hrm-079`,
    );
  }

  // ── Trong dải: đúng hai đầu mút và một điểm giữa ──
  for (const nam of [2024, 2027, 2030]) {
    assert.ok(
      quickGenerateHolidaySchema.safeParse({ year: nam }).success,
      `năm ${nam} phải qua`,
    );
  }

  // `year` vắng mặt vẫn hợp lệ: service tự lấy năm hiện tại rồi tự kiểm lại (lớp chặn thứ hai).
  assert.ok(quickGenerateHolidaySchema.safeParse({}).success);

  // Sai kiểu / không nguyên cũng phải ra đúng câu E-hrm-079, không phải câu mặc định của Zod.
  for (const xau of ['abc', null, {}, 2026.5]) {
    const r = quickGenerateHolidaySchema.safeParse({ year: xau });
    assert.ok(!r.success, `year=${JSON.stringify(xau)} phải bị từ chối`);
  }
});

/* ════════════════════════════════════════════════════════════════════
 * 5. RBAC Guard cho Cấu hình mặc định (E-hrm-077)
 * ════════════════════════════════════════════════════════════════════ */

test('assertAdminOrOwner: ADMIN và OWNER được phép, OWNER_EMPLOYEE bị chặn 403 (E-hrm-077)', async () => {
  await assert.doesNotReject(async () => {
    await assertAdminOrOwner({ user: { role: 'ADMIN' } } as any);
  });
  await assert.doesNotReject(async () => {
    await assertAdminOrOwner({ user: { role: 'OWNER' } } as any);
  });
  await assert.rejects(
    async () => {
      await assertAdminOrOwner({ user: { role: 'OWNER_EMPLOYEE' } } as any);
    },
    (err: any) => {
      return (
        err instanceof ForbiddenError &&
        err.message === MESSAGES.HRM.CAN_QUYEN_ADMIN_HOAC_OWNER
      );
    },
  );
});

/* ════════════════════════════════════════════════════════════════════
 * 6. Tầng service — kiểm bằng client Prisma GIẢ (không đụng DB thật)
 *
 * Bộ ca ở trên chỉ chạm tới hàm thuần và schema Zod, nên nó KHÔNG bắt được sai sót nằm trong
 * service (`upsert` hay `create`, có mở giao dịch hay không, `warning` gắn ở đâu). Client giả
 * dưới đây lấp đúng khoảng đó: nó ghi lại từng lời gọi Prisma để khẳng định service gọi CÁI GÌ,
 * chứ không phải chỉ trả ra cái gì.
 *
 * ⚠️ Vẫn KHÔNG phải kiểm thử tích hợp: không có Fastify, không có HTTP, không có Postgres. Mã
 * trạng thái và hình dạng envelope phải do Phase B của QA xác nhận bằng lời gọi thật.
 * ════════════════════════════════════════════════════════════════════ */

/** Client giả cho `hrm_general_settings`, ghi lại tên từng lời gọi. */
function dbCauHinhGia(coBanGhi: boolean, nhatKy: string[] = []) {
  return {
    nhatKy,
    db: {
      generalSetting: {
        findUnique: async () => {
          nhatKy.push('findUnique');
          return coBanGhi ? { id: 'DEFAULT', taxBrackets: [] } : null;
        },
        upsert: async (args: { create: object; update: object }) => {
          nhatKy.push(
            `upsert(soTruongUpdate=${Object.keys(args.update).length})`,
          );
          return { id: 'DEFAULT', ...args.create, ...args.update };
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

test('BE-06: GET trên tenant trắng dùng upsert (không phải create) và nạp biểu 7 bậc', async () => {
  const { db, nhatKy } = dbCauHinhGia(false);
  const kq = await getSettings(db);

  // `create` thua cuộc đua self-healing sẽ vỡ khóa chính rồi trả 409 cho người chỉ đang MỞ màn
  // hình. `upsert` thì không.
  assert.deepEqual(nhatKy, ['findUnique', 'upsert(soTruongUpdate=0)']);
  const bieu = (kq as unknown as { taxBrackets: TaxBracketItem[] }).taxBrackets;
  assert.equal(bieu.length, 7);
  assert.equal(bieu[6].khoang, null);
});

test('BE-06: GET khi đã có bản ghi thì KHÔNG ghi gì', async () => {
  const { db, nhatKy } = dbCauHinhGia(true);
  await getSettings(db);
  assert.deepEqual(nhatKy, ['findUnique']);
});

/*
 * `N1` — CHIỀU ĐỌC PHẢI TRẢ `null` CHO BẬC MỞ (`api-contract.md` Mục 7D.0(b)).
 *
 * Trước đây chỉ chiều GHI chuẩn hóa, ba đường đọc trả thẳng bản ghi Prisma. Tenant có dữ liệu cũ
 * ghi mốc `999999999999` sẽ mãi trả mốc số chừng nào chưa ai bấm Lưu. Giao diện tự quy về `null`
 * nên không vỡ — nhưng đó là client vá lỗi server, và mọi bên tiêu thụ khác (bộ tính lương, báo
 * cáo) vẫn thấy một ngưỡng 999 tỷ và tưởng là thật.
 */
function dbCauHinhCoMocCu(bieuTrongDb: unknown) {
  return {
    generalSetting: {
      findUnique: async () => ({ id: 'DEFAULT', taxBrackets: bieuTrongDb }),
      upsert: async () => ({ id: 'DEFAULT', taxBrackets: bieuTrongDb }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test('N1: GET trên tenant còn mốc 999999999999 vẫn trả bậc cuối là null', async () => {
  const kq = await getSettings(dbCauHinhCoMocCu(BIEU_THUE_5_BAC_CU));
  const bieu = (kq as unknown as { taxBrackets: TaxBracketItem[] }).taxBrackets;

  assert.equal(
    bieu.length,
    5,
    'không được đổi số bậc — chỉ chuẩn hóa hình dạng bậc mở',
  );
  assert.equal(
    bieu[4].khoang,
    null,
    `bậc cuối phải là null, đang là ${bieu[4].khoang}`,
  );
  assert.equal(bieu[4].thueSuat, 25, 'thuế suất giữ nguyên');
  assert.ok(!bieu.some((b) => b.khoang === MOC_TUONG_THICH_BAC_MO));

  // Bốn bậc đầu không bị đụng tới.
  assert.deepEqual(bieu.slice(0, 4), BIEU_THUE_5_BAC_CU.slice(0, 4));
});

test('N1: cả ba đường đọc (GET / PUT / restore-default) đều chuẩn hóa mốc mở', async () => {
  const bieuCu = [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 999999999999, thueSuat: 35 },
  ];

  const rGet = (await getSettings(dbCauHinhCoMocCu(bieuCu))) as unknown as {
    taxBrackets: TaxBracketItem[];
  };
  assert.equal(rGet.taxBrackets[1].khoang, null, 'getSettings chưa chuẩn hóa');

  const rPut = (await updateSettings(dbCauHinhCoMocCu(bieuCu), {
    baseSalary: 3000000,
  })) as unknown as { taxBrackets: TaxBracketItem[] };
  assert.equal(
    rPut.taxBrackets[1].khoang,
    null,
    'updateSettings chưa chuẩn hóa',
  );

  const rRestore = (await restoreDefault(
    dbCauHinhCoMocCu(bieuCu),
  )) as unknown as {
    taxBrackets: TaxBracketItem[];
  };
  assert.equal(
    rRestore.taxBrackets[1].khoang,
    null,
    'restoreDefault chưa chuẩn hóa',
  );
});

test('N1: dữ liệu cột Json méo mó thì trả nguyên trạng, KHÔNG ném lỗi', async () => {
  // Người dùng chỉ đang MỞ MÀN HÌNH — không được biến dữ liệu hỏng thành 500.
  for (const meoMo of [null, [], 'chuỗi lạ', [null, null], [{ a: 1 }], 42]) {
    const kq = (await getSettings(dbCauHinhCoMocCu(meoMo))) as unknown as {
      taxBrackets: unknown;
    };
    assert.deepEqual(
      kq.taxBrackets,
      meoMo,
      `dữ liệu ${JSON.stringify(meoMo)} phải giữ nguyên`,
    );
  }

  // Bậc cuối là số NHỎ hơn mốc tương thích -> đó là ngưỡng thật của người dùng, không được đụng.
  const bieuThat = [
    { khoang: 5000000, thueSuat: 5 },
    { khoang: 80000000, thueSuat: 30 },
  ];
  const giuNguyen = (await getSettings(
    dbCauHinhCoMocCu(bieuThat),
  )) as unknown as {
    taxBrackets: TaxBracketItem[];
  };
  assert.equal(giuNguyen.taxBrackets[1].khoang, 80000000);
});

test('AC-hrm-70 / BE-11: PUT trả warning đúng ba tình huống', async () => {
  // (a) Không gửi taxBrackets -> BỎ HẲN trường warning.
  const rKhongGui = await updateSettings(dbCauHinhGia(true).db, {
    baseSalary: 3000000,
  });
  assert.ok(!('warning' in rKhongGui));

  // (b) Gửi đúng biểu chuẩn -> cũng bỏ hẳn trường.
  const rChuan = await updateSettings(dbCauHinhGia(true).db, {
    taxBrackets: BIEU_THUE_CHUAN_7_BAC,
  });
  assert.ok(!('warning' in rChuan));

  // (c) Gửi biểu lệch chuẩn nhưng hợp lệ về cấu trúc -> LƯU ĐƯỢC, kèm cảnh báo.
  const rLech = await updateSettings(dbCauHinhGia(true).db, {
    taxBrackets: [
      { khoang: 5000000, thueSuat: 5 },
      { khoang: 18000000, thueSuat: 15 },
      { khoang: 52000000, thueSuat: 25 },
      { khoang: 80000000, thueSuat: 30 },
      { khoang: null, thueSuat: 35 },
    ],
  });
  assert.equal(rLech.warning, HRM_CANH_BAO.BIEU_THUE_LECH_CHUAN);
});

test('AC-hrm-67 / BE-09: restore-default ghi biểu 7 bậc và KHÔNG bao giờ kèm warning', async () => {
  const kq = await restoreDefault(dbCauHinhGia(true).db);
  const bieu = (kq as unknown as { taxBrackets: TaxBracketItem[] }).taxBrackets;
  assert.equal(bieu.length, 7);
  assert.equal(bieu[6].khoang, null);
  assert.ok(!('warning' in (kq as object)));
});

/*
 * `BE-08` VIẾT LẠI LẦN HAI (N2 → BUG-HRM-51).
 *
 * Bản gốc chỉ khẳng định `$transaction` ĐÃ ĐƯỢC GỌI — khẳng định lại chính cài đặt, không kiểm
 * hành vi nào. Bản `N2` sửa lại thành "`addedCount` lấy thẳng từ `createMany().count`".
 *
 * Nay `BUG-HRM-51` đổi lần nữa và ĐỔI CÓ CHỦ ĐÍCH: chỉ phần **chưa được phủ** mới được gửi đi,
 * và `addedCount` = số phần tử `items[]` có `alreadyCovered === false` (xem khối chú thích "CON
 * SỐ NÀO LẤY TỪ ĐÂU" trong `holidays.service.ts`). Để chứng minh điều đó chứ không chỉ mô tả nó,
 * `createMany` giả dưới đây trả về `count: 999` — một con số CỐ TÌNH SAI. Ai lỡ đưa
 * `createMany().count` trở lại làm `addedCount` sẽ thấy `999` bật ra ngay.
 */
test('BE-08 / N2 + BUG-HRM-51: MỘT câu lệnh ghi, chỉ gửi phần chưa phủ, addedCount không lấy từ createMany().count', async () => {
  const goiVoiKhoSan = async (
    seed: Array<{ date: string; name: string; isAnnual?: boolean }>,
  ) => {
    let soLanCreateMany = 0;
    let dulieuDaGui: Array<{ date: Date; name: string }> = [];
    let daDungSkipDuplicates = false;
    const daCo = seed.map((s) => ({
      date: new Date(`${s.date}T00:00:00.000Z`),
      name: s.name,
      isAnnual: s.isAnnual ?? true,
    }));
    const db = {
      holiday: {
        findMany: async ({ where }: { where: { name: { in: string[] } } }) =>
          daCo.filter((r) => where.name.in.includes(r.name)),
        createMany: async ({
          data,
          skipDuplicates,
        }: {
          data: Array<{ date: Date; name: string }>;
          skipDuplicates: boolean;
        }) => {
          soLanCreateMany++;
          dulieuDaGui = data;
          daDungSkipDuplicates = skipDuplicates;
          return { count: 999 }; // cố tình sai — addedCount không được lấy từ đây
        },
        count: async () => {
          throw new Error(
            'không được dùng count() — quy tắc phủ đọc bằng findMany',
          );
        },
      },
      $transaction: async () => {
        throw new Error('không cần giao dịch cho một câu lệnh ghi duy nhất');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const kq = await quickGenerateHolidays(db, 2026);
    return { kq, soLanCreateMany, dulieuDaGui, daDungSkipDuplicates };
  };

  const chuan2026 = layDanhSach11NgayLeChuan(2026);

  // Tenant trắng: gửi cả 11 dòng.
  const trang = await goiVoiKhoSan([]);
  assert.equal(trang.kq.addedCount, 11);
  assert.equal(trang.kq.skippedCount, 0);
  assert.equal(trang.kq.totalStandard, 11);
  assert.equal(trang.kq.year, 2026);
  assert.equal(trang.soLanCreateMany, 1, 'đúng MỘT câu lệnh ghi');
  assert.equal(trang.dulieuDaGui.length, 11);
  assert.equal(
    trang.daDungSkipDuplicates,
    true,
    'phải là ON CONFLICT DO NOTHING',
  );

  // Đã có sẵn 1 ngày trùng TRỌN cặp `(date, name)`.
  const coMotTrung = await goiVoiKhoSan([
    { date: chuan2026[0].date, name: chuan2026[0].name },
  ]);
  assert.equal(coMotTrung.kq.addedCount, 10);
  assert.equal(coMotTrung.kq.skippedCount, 1);
  assert.equal(
    coMotTrung.dulieuDaGui.length,
    10,
    'dòng đã có KHÔNG được gửi đi nữa',
  );
  assert.ok(
    !coMotTrung.dulieuDaGui.some(
      (d) =>
        d.name === chuan2026[0].name &&
        d.date.toISOString().slice(0, 10) === chuan2026[0].date,
    ),
  );

  // Bấm lần hai: đủ 11 dòng, không còn gì để gửi.
  const lanHai = await goiVoiKhoSan(
    chuan2026.map((t) => ({ date: t.date, name: t.name })),
  );
  assert.equal(lanHai.kq.addedCount, 0);
  assert.equal(lanHai.kq.skippedCount, 11);
  assert.equal(lanHai.dulieuDaGui.length, 0);
  assert.equal(
    lanHai.kq.items.length,
    11,
    'items vẫn trả đủ 11 mẫu dù không gửi dòng nào',
  );

  // Trường hợp giữa chừng — chứng minh hai con số bám theo dữ liệu, không phải hằng số cứng.
  const motNua = await goiVoiKhoSan(
    chuan2026.slice(0, 4).map((t) => ({ date: t.date, name: t.name })),
  );
  assert.equal(motNua.kq.addedCount, 7);
  assert.equal(motNua.kq.skippedCount, 4);
  assert.equal(motNua.dulieuDaGui.length, 7);
});

test('BE-08b: quick-generate chạy được cả khi tầng gọi đã mở giao dịch (TransactionClient)', async () => {
  /*
   * `Prisma.TransactionClient` KHÔNG có `$transaction`. Trước đây hàm phải tự dò xem có mở giao
   * dịch được không; nay chỉ còn một truy vấn đọc và một câu lệnh ghi nên chạy thẳng trên client
   * nào cũng được. Giữ ca này để nếu ai đó bọc lại giao dịch thì lỗi lộ ra ngay chứ không đợi tới
   * lúc chạy thật.
   */
  const kq = await quickGenerateHolidays(
    {
      holiday: {
        findMany: async () => [],
        createMany: async () => ({ count: 11 }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    2026,
  );
  assert.equal(kq.totalStandard, 11);
  assert.equal(kq.addedCount, 11);
  assert.equal(kq.skippedCount, 0);
});

test('BE-07: quick-generate không gửi year thì lấy năm theo GIỜ VIỆT NAM', async () => {
  // 00:30 giờ VN ngày 01/01/2027 == 17:30 UTC ngày 31/12/2026.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T17:30:00Z') });
  try {
    // Mốc thử được chọn để LỊCH UTC còn ở năm cũ. Trên máy chủ chạy UTC thì `getFullYear()`
    // chính là con số này (2026) — đó là cái bug. So bằng `getUTCFullYear()` để phép kiểm không
    // đổi kết quả theo múi giờ của máy chạy test (máy Việt Nam sẽ cho `getFullYear()` là 2027,
    // và đúng vì thế mà bug không lộ ra ở môi trường phát triển).
    assert.equal(
      new Date().getUTCFullYear(),
      2026,
      'mốc thử phải nằm ở năm cũ theo lịch UTC',
    );
    const kq = await quickGenerateHolidays({
      holiday: {
        findMany: async () => [],
        createMany: async () => ({ count: 11 }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    assert.equal(kq.year, 2027);
  } finally {
    mock.timers.reset();
  }
});

test('BE-04 / ADR-001: mã ca tự sinh bị chiếm mất thì thử lại, không ném 409 oan', async () => {
  const daCo = new Set(['CA01']);
  let soLanGoiCreate = 0;
  const db = {
    workShift: {
      findMany: async () => [...daCo].map((code) => ({ code })),
      create: async ({ data }: { data: { code: string } }) => {
        soLanGoiCreate++;
        if (soLanGoiCreate === 1) {
          // Người khác vừa chiếm mất CA02 giữa lúc mình quét và lúc mình ghi.
          daCo.add('CA02');
          throw new Prisma.PrismaClientKnownRequestError('trùng khóa', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        return {
          ...data,
          id: 'ws-1',
          breakMinutes: 60,
          startTime: '08:00',
          endTime: '17:00',
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const ca = await createWorkShift(db, {
    name: 'Ca hành chính',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    status: 'ACTIVE',
  });

  assert.equal(soLanGoiCreate, 2, 'phải thử lại đúng một lần');
  assert.equal(
    ca.code,
    'CA03',
    'lượt sau phải thấy CA02 đã bị chiếm và nhảy sang CA03',
  );
});

test('AC-hrm-63 / BE-02: warning có mặt ở đường POST /work-shifts, không chỉ ở hàm tính', async () => {
  const db = {
    workShift: {
      findMany: async () => [],
      create: async ({ data }: { data: object }) => ({ ...data, id: 'ws-2' }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const caDai = await createWorkShift(db, {
    name: 'Ca trực 24h',
    startTime: '08:00',
    endTime: '08:00',
    breakMinutes: 120,
    status: 'ACTIVE',
  });
  assert.equal(caDai.workingHours, 22);
  assert.equal(caDai.warning, HRM_CANH_BAO.GIO_LAM_VUOT_TRAN_BLLD);

  const caThuong = await createWorkShift(db, {
    name: 'Ca hành chính',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    status: 'ACTIVE',
  });
  assert.ok(!('warning' in caThuong));
});

/* ════════════════════════════════════════════════════════════════════
 * 7. Chế độ chạy thử (dryRun) của "Tạo nhanh lịch nghỉ lễ"
 *
 * BỐI CẢNH: hộp thoại "Tạo nhanh" ở giao diện từng tự tính bản xem trước bằng một bảng tra âm
 * lịch chép tay RIÊNG. Hai nguồn nên hai kết quả: xem trước hiện cụm Tết 2026 là 16–20/02 trong
 * khi máy chủ ghi 15–19/02. Nay giao diện hỏi thẳng máy chủ, nên phép kiểm nặng nhất của nhóm
 * này là: items[] của bản xem trước phải TRÙNG KHỚP items[] của lượt ghi thật, và trùng khớp cả
 * với thứ THỰC SỰ nằm lại trong kho sau khi ghi.
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Kho ngày lễ giả — mô phỏng đúng ba điều Postgres bảo đảm cho bảng `hrm_holidays`:
 *   · khóa duy nhất `@@unique([date, name])` — trùng phải khớp CẢ HAI cột;
 *   · `createMany({ skipDuplicates: true })` là `INSERT ... ON CONFLICT DO NOTHING`, `count` trả
 *     về là số dòng THỰC SỰ chèn được;
 *   · `findMany({ where: { name: { in: [...] } } })` lọc theo tên, và `date` của cột `@db.Date`
 *     luôn ra `Date` đặt tại **nửa đêm UTC**.
 *
 * Nhờ mô phỏng thật ba điều đó, ca kiểm so được dự báo với kết quả thật thay vì chỉ khẳng định
 * "hàm đã được gọi" (đúng lỗi tautology của bản `BE-08` cũ).
 *
 * `isAnnual` của dòng gieo mặc định là `true` — giống hệt `@default(true)` của Prisma. Ca nào
 * quan tâm tới cờ này phải ghi rõ, vì đúng nó quyết định quy tắc phủ của `BUG-HRM-51`.
 */
interface DongLeGia {
  date: Date;
  name: string;
  isAnnual: boolean;
}

function taoKhoNgayLeGia(
  seed: Array<{ date: string; name: string; isAnnual?: boolean }> = [],
) {
  const rows: DongLeGia[] = seed.map((s) => ({
    date: new Date(`${s.date}T00:00:00.000Z`),
    name: s.name,
    isAnnual: s.isAnnual ?? true,
  }));
  let soLanCreateMany = 0;
  let soLanCount = 0;
  let soLanFindMany = 0;
  let camGhi = false;

  const daTonTai = (date: Date, name: string) =>
    rows.some((r) => r.date.getTime() === date.getTime() && r.name === name);

  const db = {
    holiday: {
      count: async ({
        where,
      }: {
        where?: { OR?: Array<{ date: Date; name: string }> };
      }) => {
        soLanCount++;
        const dieuKien = where?.OR ?? [];
        return rows.filter((r) =>
          dieuKien.some(
            (d) => d.date.getTime() === r.date.getTime() && d.name === r.name,
          ),
        ).length;
      },
      findMany: async ({ where }: { where?: { name?: { in?: string[] } } }) => {
        soLanFindMany++;
        const ten = where?.name?.in;
        const loc =
          ten === undefined ? rows : rows.filter((r) => ten.includes(r.name));
        // Trả BẢN SAO — service không được sửa được kho qua tham chiếu.
        return loc.map((r) => ({
          date: new Date(r.date),
          name: r.name,
          isAnnual: r.isAnnual,
        }));
      },
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<{ date: Date; name: string; isAnnual: boolean }>;
        skipDuplicates?: boolean;
      }) => {
        soLanCreateMany++;
        if (camGhi) {
          throw new Error(
            'CHẠY THỬ MÀ VẪN GHI: createMany đã bị gọi trong chế độ dryRun',
          );
        }
        let count = 0;
        for (const d of data) {
          if (daTonTai(d.date, d.name)) {
            if (!skipDuplicates) {
              throw new Error('trùng khóa @@unique([date, name])');
            }
            continue;
          }
          rows.push({ date: d.date, name: d.name, isAnnual: d.isAnnual });
          count++;
        }
        return { count };
      },
    },
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: db as any,
    rows,
    get soLanCreateMany() {
      return soLanCreateMany;
    },
    get soLanCount() {
      return soLanCount;
    },
    get soLanFindMany() {
      return soLanFindMany;
    },
    /** Các dòng đang có, dạng `YYYY-MM-DD|tên`, đã sắp xếp — tiện để so nguyên khối. */
    khoaDangCo() {
      return rows
        .map((r) => `${r.date.toISOString().slice(0, 10)}|${r.name}`)
        .sort();
    },
    /** Từ lúc gọi hàm này, mọi lời gọi `createMany` đều ném lỗi. */
    camGhiLai() {
      camGhi = true;
    },
  };
}

test('dryRun: schema nhận boolean THẬT, từ chối chuỗi "false" (không được dùng z.coerce.boolean)', () => {
  const bat = quickGenerateHolidaySchema.safeParse({
    year: 2026,
    dryRun: true,
  });
  assert.equal(bat.success && bat.data.dryRun, true);

  const tat = quickGenerateHolidaySchema.safeParse({
    year: 2026,
    dryRun: false,
  });
  assert.equal(tat.success && tat.data.dryRun, false);

  const vang = quickGenerateHolidaySchema.safeParse({ year: 2026 });
  assert.equal(vang.success, true);
  assert.equal(
    vang.success && vang.data.dryRun,
    undefined,
    'vắng mặt phải là undefined, không tự thành false',
  );

  /*
   * Chốt lại lỗi `BE-03`: `z.coerce.boolean()` biến chuỗi "false" thành `true`
   * (`Boolean("false") === true`). Ai đổi sang `coerce` thì hai khẳng định dưới đỏ ngay.
   */
  const chuoiFalse = quickGenerateHolidaySchema.safeParse({
    year: 2026,
    dryRun: 'false',
  });
  assert.equal(
    chuoiFalse.success,
    false,
    'chuỗi "false" phải bị từ chối 400, không được đoán thành true',
  );
  const chuoiTrue = quickGenerateHolidaySchema.safeParse({
    year: 2026,
    dryRun: 'true',
  });
  assert.equal(
    chuoiTrue.success,
    false,
    'chuỗi "true" cũng bị từ chối — thân JSON có boolean thật',
  );
});

test('dryRun = true: KHÔNG ghi một dòng nào nhưng vẫn trả đủ 11 items, đúng hình dạng cũ', async () => {
  const kho = taoKhoNgayLeGia();
  kho.camGhiLai(); // từ đây mọi lời gọi createMany đều ném lỗi

  const kq = await quickGenerateHolidays(kho.db, 2026, true);

  assert.equal(
    kho.soLanCreateMany,
    0,
    'dryRun mà vẫn gọi createMany là hỏng trọn vẹn tính năng',
  );
  assert.equal(kho.rows.length, 0, 'kho phải trắng nguyên như trước khi gọi');
  assert.equal(
    kq.items.length,
    11,
    'vẫn phải trả đủ 11 ngày lễ để giao diện vẽ bản xem trước',
  );
  assert.equal(kq.totalStandard, 11);
  assert.equal(kq.year, 2026);
  assert.equal(kq.addedCount, 11, 'tenant trắng thì dự báo thêm đủ 11');
  assert.equal(kq.skippedCount, 0);
  assert.deepEqual(
    Object.keys(kq).sort(),
    ['addedCount', 'items', 'skippedCount', 'totalStandard', 'year'],
    'hình dạng phản hồi KHÔNG được đổi giữa hai chế độ',
  );
  assert.deepEqual(
    Object.keys(kq.items[0]).sort(),
    ['alreadyCovered', 'date', 'isAnnual', 'isPaid', 'name', 'type'],
    'mỗi phần tử items[] phải có đủ 6 trường, kể cả alreadyCovered (BUG-HRM-51)',
  );
});

test('dryRun = true: dự báo đúng addedCount/skippedCount khi tenant đã có sẵn vài ngày', async () => {
  const chuan = layDanhSach11NgayLeChuan(2026);
  assert.equal(chuan.length, 11);

  const kho = taoKhoNgayLeGia([
    // Trùng TRỌN cặp (date, name) — ON CONFLICT DO NOTHING sẽ bỏ qua.
    { date: chuan[0].date, name: chuan[0].name },
    { date: chuan[5].date, name: chuan[5].name },
    // Cùng NGÀY nhưng khác TÊN — khóa duy nhất là cặp hai cột nên KHÔNG chặn dòng chuẩn.
    { date: chuan[2].date, name: 'Nghỉ bù công ty' },
    // Cùng TÊN nhưng khác NGÀY — cũng không chặn.
    { date: '2026-06-15', name: chuan[3].name },
  ]);

  const duBao = await quickGenerateHolidays(kho.db, 2026, true);
  assert.equal(
    duBao.skippedCount,
    2,
    'chỉ 2 dòng trùng TRỌN cặp (date, name) mới bị bỏ qua',
  );
  assert.equal(duBao.addedCount, 9);
  assert.equal(kho.soLanCreateMany, 0);
  assert.equal(kho.rows.length, 4, 'chạy thử không được thêm hay bớt dòng nào');

  /*
   * CHỐT HẠ: ghi thật ngay sau đó trên CÙNG một kho, không ai chen ngang, thì con số thực tế
   * phải bằng đúng con số vừa dự báo. Dự báo lệch (vd chỉ so `date`, hoặc đếm mọi dòng trong
   * bảng) sẽ đỏ ngay ở đây.
   */
  const that = await quickGenerateHolidays(kho.db, 2026);
  assert.equal(
    that.addedCount,
    duBao.addedCount,
    'dự báo addedCount phải khớp lượt ghi thật',
  );
  assert.equal(
    that.skippedCount,
    duBao.skippedCount,
    'dự báo skippedCount phải khớp lượt ghi thật',
  );
  assert.equal(kho.rows.length, 4 + 9, '4 dòng cũ cộng 9 dòng mới');
});

test('dryRun vắng mặt hoặc false: vẫn ghi y như cũ (tương thích ngược)', async () => {
  for (const co of [undefined, false] as const) {
    const kho = taoKhoNgayLeGia();
    const kq = await quickGenerateHolidays(kho.db, 2026, co);
    assert.equal(
      kho.soLanCreateMany,
      1,
      `dryRun=${String(co)} phải đi đường ghi thật`,
    );
    /*
     * Đường ghi nay là ĐÚNG 1 truy vấn đọc + 1 câu lệnh ghi. Truy vấn đọc là bắt buộc kể từ
     * `BUG-HRM-51`: quy tắc "dòng lặp-hàng-năm đã phủ" không thể diễn đạt bằng `ON CONFLICT`, phải
     * đọc mới quyết định được. Nó KHÁC hẳn mẫu "đếm → chèn → đếm rồi lấy hiệu" mà bản vá `N2` đã
     * bỏ: `count()` vẫn không được gọi, và không có truy vấn nào chạy SAU câu lệnh ghi.
     */
    assert.equal(
      kho.soLanFindMany,
      1,
      'đúng 1 truy vấn đọc để quyết định phần cần ghi',
    );
    assert.equal(
      kho.soLanCount,
      0,
      'không còn dùng count() — mẫu "đếm rồi lấy hiệu" đã bỏ từ N2',
    );
    assert.equal(kho.rows.length, 11);
    assert.equal(kq.addedCount, 11);
    assert.equal(kq.skippedCount, 0);
  }

  // Gọi đúng chữ ký CŨ (hai tham số) — cách mọi chỗ gọi trước đợt này vẫn dùng.
  const khoCu = taoKhoNgayLeGia();
  const kqCu = await quickGenerateHolidays(khoCu.db, 2026);
  assert.equal(
    khoCu.rows.length,
    11,
    'chữ ký cũ hai tham số phải giữ nguyên hành vi ghi',
  );
  assert.equal(kqCu.addedCount, 11);
});

test('dryRun: items[] của bản xem trước TRÙNG KHỚP items[] của lượt tạo thật, 2024–2030', async () => {
  for (let y = 2024; y <= 2030; y++) {
    const khoThu = taoKhoNgayLeGia();
    khoThu.camGhiLai();
    const xemTruoc = await quickGenerateHolidays(khoThu.db, y, true);

    const khoThat = taoKhoNgayLeGia();
    const taoThat = await quickGenerateHolidays(khoThat.db, y);

    assert.deepEqual(
      xemTruoc.items,
      taoThat.items,
      `năm ${y}: xem trước và ghi thật phải là MỘT`,
    );
    assert.equal(xemTruoc.totalStandard, taoThat.totalStandard);
    assert.equal(xemTruoc.year, taoThat.year);

    /*
     * Không chỉ so hai thân phản hồi với nhau — so cả với thứ THỰC SỰ nằm lại trong kho sau khi
     * ghi (đã đi qua phép đổi chuỗi ngày sang Date lúc nửa đêm UTC). Đây mới là phép kiểm bắt
     * được trường hợp ai đó dựng items[] từ một nguồn khác nguồn dựng dữ liệu ghi.
     */
    const sapXep = (
      a: { date: string; name: string },
      b: { date: string; name: string },
    ) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
    const daLuu = khoThat.rows
      .map((r) => ({ date: r.date.toISOString().slice(0, 10), name: r.name }))
      .sort(sapXep);
    const theoXemTruoc = xemTruoc.items
      .map((i) => ({ date: i.date, name: i.name }))
      .sort(sapXep);
    assert.deepEqual(
      theoXemTruoc,
      daLuu,
      `năm ${y}: xem trước phải bằng đúng thứ đã nằm trong DB`,
    );
  }
});

test('dryRun: bản xem trước Tết 2026 là 15–19/02 — đúng chỗ giao diện từng hiện 16–20/02', async () => {
  const kho = taoKhoNgayLeGia();
  kho.camGhiLai();
  const xemTruoc = await quickGenerateHolidays(kho.db, 2026, true);

  const cumTet = xemTruoc.items
    .filter((i) => i.type === 'LUNAR' && i.date.startsWith('2026-02'))
    .map((i) => i.date);
  assert.deepEqual(
    cumTet,
    ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'],
    'bảng tra tay của giao diện từng cho 16–20/02; máy chủ ghi 15–19/02 — nay chỉ còn một nguồn',
  );
});

test('dryRun: chạy thử KHÔNG lách được chặn dải năm 2024–2030', async () => {
  const kho = taoKhoNgayLeGia();
  kho.camGhiLai();

  const thongDiep = MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID;
  for (const y of [2023, 2031]) {
    await assert.rejects(
      async () => {
        await quickGenerateHolidays(kho.db, y, true);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: any) => err instanceof BadRequestError && err.message === thongDiep,
      `năm ${y} phải bị chặn kể cả ở chế độ chạy thử`,
    );
  }
  assert.equal(
    kho.soLanCount,
    0,
    'phải chặn TRƯỚC mọi truy vấn, không đụng DB',
  );
  assert.equal(kho.soLanCreateMany, 0);
});

/* ════════════════════════════════════════════════════════════════════
 * 8. BUG-HRM-51 — "Tạo nhanh" năm sau KHÔNG được đẻ dòng lặp-hàng-năm TRÙNG NGHĨA
 *
 * Lỗi đo được trên giao diện đang chạy (2026-09-08): tenant đã có `2026-01-01 Tết Dương lịch`
 * với `isAnnual = true`, bấm Tạo nhanh 2027 vẫn báo "thêm 11 / bỏ qua 0" và ghi thêm
 * `2027-01-01 Tết Dương lịch isAnnual = true` — dòng thứ hai cùng nghĩa. `@@unique([date, name])`
 * không chặn vì khác `date`. Cả 5 ngày lễ dương lịch đều vậy; chạy tiếp 2028–2030 để lại tới 20
 * dòng thừa, và bảng lương đếm theo dòng sẽ tính một ngày lễ nhiều lần.
 *
 * Quy tắc đã chốt: một mục chuẩn coi như ĐÃ ĐƯỢC PHỦ nếu tenant có dòng thỏa cả ba — cùng `name`,
 * cùng ngày/tháng (bất kể năm), và dòng đó `isAnnual = true`. Cộng dồn với quy tắc `(date, name)`
 * cũ, KHÔNG thay thế nó.
 * ════════════════════════════════════════════════════════════════════ */

/** Năm ngày lễ dương lịch cố định — nhóm duy nhất mà quy tắc phủ được phép áp. */
const TEN_LE_DUONG_LICH = [
  'Tết Dương lịch',
  'Ngày Giải phóng miền Nam',
  'Ngày Quốc tế Lao động',
  'Nghỉ liền kề Quốc khánh',
  'Ngày Quốc khánh',
];

/** Đếm số phần tử `items[]` sẽ được tạo (`alreadyCovered === false`). */
function demSeTao(kq: { items: Array<{ alreadyCovered: boolean }> }) {
  return kq.items.filter((i) => i.alreadyCovered === false).length;
}

test('BUG-HRM-51: dòng lặp-hàng-năm của năm cũ PHỦ mục chuẩn cùng ngày/tháng của năm sau', async () => {
  // Đúng tình huống đã bấm thật: tenant chỉ có MỘT dòng 01/01/2026 lặp hàng năm.
  const kho = taoKhoNgayLeGia([
    { date: '2026-01-01', name: 'Tết Dương lịch', isAnnual: true },
  ]);

  const xemTruoc = await quickGenerateHolidays(kho.db, 2027, true);
  const mucTetDuong = xemTruoc.items.find((i) => i.date === '2027-01-01');
  assert.ok(mucTetDuong, 'phải vẫn liệt kê 01/01/2027 trong bản xem trước');
  assert.equal(
    mucTetDuong.alreadyCovered,
    true,
    'dòng 2026-01-01 isAnnual=true đã phủ 01/01 mọi năm — 2027 KHÔNG được tạo nữa',
  );
  assert.equal(xemTruoc.totalStandard, 11, 'totalStandard giữ nguyên 11');
  assert.equal(xemTruoc.addedCount, 10);
  assert.equal(xemTruoc.skippedCount, 1);

  // Ghi thật ngay sau đó trên cùng kho: không dòng 2027-01-01 nào được sinh ra.
  const that = await quickGenerateHolidays(kho.db, 2027);
  assert.equal(that.addedCount, 10, 'ghi thật phải khớp bản xem trước');
  assert.equal(that.skippedCount, 1);
  assert.ok(
    !kho.khoaDangCo().includes('2027-01-01|Tết Dương lịch'),
    `ĐÃ SINH DÒNG TRÙNG NGHĨA: ${kho.khoaDangCo().join(' , ')}`,
  );
  assert.equal(
    kho.rows.filter((r) => r.name === 'Tết Dương lịch').length,
    1,
    'toàn kho chỉ được có ĐÚNG MỘT dòng Tết Dương lịch',
  );
});

test('BUG-HRM-51: đã Tạo nhanh 2026 rồi Tạo nhanh 2027 -> chỉ thêm 6 ngày ÂM LỊCH', async () => {
  const kho = taoKhoNgayLeGia();

  const nam2026 = await quickGenerateHolidays(kho.db, 2026);
  assert.equal(nam2026.addedCount, 11, 'tenant trắng: cả 11 ngày đều mới');
  assert.equal(kho.rows.length, 11);

  const nam2027 = await quickGenerateHolidays(kho.db, 2027);
  assert.equal(
    nam2027.totalStandard,
    11,
    'totalStandard vẫn là 11, không đổi ngữ nghĩa',
  );
  assert.equal(
    nam2027.addedCount,
    6,
    '5 ngày dương lịch đã được phủ, chỉ còn 6 ngày âm lịch',
  );
  assert.equal(nam2027.skippedCount, 5);
  assert.equal(
    kho.rows.length,
    17,
    '11 dòng của 2026 cộng 6 ngày âm lịch của 2027',
  );

  // Từng ngày dương lịch cố định chỉ được tồn tại ĐÚNG MỘT dòng trong toàn kho.
  for (const ten of TEN_LE_DUONG_LICH) {
    assert.equal(
      kho.rows.filter((r) => r.name === ten).length,
      1,
      `"${ten}" bị nhân đôi`,
    );
  }

  // Nhãn trên từng mục phải khớp: dương lịch = đã phủ, âm lịch = sẽ tạo.
  for (const i of nam2027.items) {
    assert.equal(
      i.alreadyCovered,
      i.type === 'NATIONAL',
      `${i.date} ${i.name}: nhãn alreadyCovered sai`,
    );
  }
});

test('BUG-HRM-51: chạy liên tiếp 2026→2030 KHÔNG để lại một dòng dương lịch thừa nào', async () => {
  const kho = taoKhoNgayLeGia();
  for (let y = 2026; y <= 2030; y++) {
    await quickGenerateHolidays(kho.db, y);
  }

  for (const ten of TEN_LE_DUONG_LICH) {
    const dong = kho.rows.filter((r) => r.name === ten);
    assert.equal(
      dong.length,
      1,
      `"${ten}" có ${dong.length} dòng: ${dong.map((d) => d.date.toISOString().slice(0, 10)).join(', ')}`,
    );
    assert.equal(
      dong[0].date.getUTCFullYear(),
      2026,
      'dòng duy nhất phải là dòng của năm chạy ĐẦU TIÊN, các năm sau không ghi đè',
    );
  }

  // 5 dòng dương lịch (chỉ năm 2026) + 6 ngày âm lịch × 5 năm = 35 dòng.
  assert.equal(
    kho.rows.length,
    5 + 6 * 5,
    `tổng số dòng sai: ${kho.rows.length}`,
  );
});

test('BUG-HRM-51 (CHỐNG HỒI QUY QUAN TRỌNG NHẤT): lễ ÂM LỊCH vẫn được tạo cho năm mới', async () => {
  /*
   * Ngày dương của lễ âm đổi mỗi năm, nên chúng mang `isAnnual = false` và mỗi năm BẮT BUỘC có
   * dòng riêng. Quy tắc phủ mà lỡ áp cho chúng thì Tết năm sau biến mất khỏi lịch — sai tiền
   * lương ngày lễ, và sai theo kiểu không ai thấy.
   *
   * Kho dưới đây gieo một dòng CỰC ĐỘC: cùng TÊN với Mùng 1 của 2027, cùng NGÀY/THÁNG (06/02),
   * khác NĂM, và mang `isAnnual = true`. Dòng như thế chỉ ghi thẳng DB mới tạo được (`E-hrm-075`
   * chặn mọi đường API), nhưng nếu quy tắc phủ không kiểm cờ `isAnnual` của chính MỤC CHUẨN thì
   * nó sẽ nuốt mất Mùng 1 Tết 2027.
   */
  const chuan2027 = layDanhSach11NgayLeChuan(2027);
  const mung1 = chuan2027.find((t) => t.name === 'Tết Nguyên Đán (Mùng 1)');
  assert.ok(mung1);
  assert.equal(mung1.date, '2027-02-06');
  assert.equal(mung1.isAnnual, false, 'lễ âm lịch phải là isAnnual = false');

  const kho = taoKhoNgayLeGia([
    { date: '2026-02-06', name: 'Tết Nguyên Đán (Mùng 1)', isAnnual: true }, // dòng bẫy
  ]);
  assert.equal(
    '2026-02-06'.slice(5),
    mung1.date.slice(5),
    'dòng bẫy phải cùng ngày/tháng với Mùng 1 của 2027',
  );

  const kq = await quickGenerateHolidays(kho.db, 2027);
  const mucMung1 = kq.items.find((i) => i.date === '2027-02-06');
  assert.ok(mucMung1);
  assert.equal(
    mucMung1.alreadyCovered,
    false,
    'lễ ÂM LỊCH không bao giờ được coi là đã phủ bởi dòng lặp hàng năm',
  );
  assert.ok(
    kho.khoaDangCo().includes('2027-02-06|Tết Nguyên Đán (Mùng 1)'),
    `Mùng 1 Tết 2027 bị chặn nhầm: ${kho.khoaDangCo().join(' , ')}`,
  );
  assert.equal(
    kq.addedCount,
    11,
    'không mục chuẩn nào của 2027 bị dòng bẫy phủ',
  );

  // Chạy tiếp 2028: 6 ngày âm lịch của 2028 vẫn phải ra đủ.
  const nam2028 = await quickGenerateHolidays(kho.db, 2028);
  assert.equal(
    nam2028.items.filter(
      (i) => i.type === 'LUNAR' && i.alreadyCovered === false,
    ).length,
    6,
    'sáu ngày âm lịch của 2028 phải đều được tạo',
  );
});

test('BUG-HRM-51: dòng cũ isAnnual = false KHÔNG phủ năm sau — năm mới vẫn có dòng riêng', async () => {
  const kho = taoKhoNgayLeGia([
    { date: '2026-01-01', name: 'Tết Dương lịch', isAnnual: false },
  ]);

  const kq = await quickGenerateHolidays(kho.db, 2027);
  const muc = kq.items.find((i) => i.date === '2027-01-01');
  assert.ok(muc);
  assert.equal(
    muc.alreadyCovered,
    false,
    'dòng cũ không bật cờ lặp hàng năm thì chỉ phủ đúng năm của chính nó',
  );
  assert.equal(kq.addedCount, 11);
  assert.ok(kho.khoaDangCo().includes('2027-01-01|Tết Dương lịch'));
  assert.equal(kho.rows.filter((r) => r.name === 'Tết Dương lịch').length, 2);
});

test('BUG-HRM-51: quy tắc (date, name) cũ vẫn còn nguyên — cộng dồn, không bị thay thế', async () => {
  const chuan = layDanhSach11NgayLeChuan(2026);
  const kho = taoKhoNgayLeGia([
    // Trùng TRỌN cặp nhưng KHÔNG lặp hàng năm -> vẫn phải bỏ qua theo quy tắc (1).
    { date: chuan[1].date, name: chuan[1].name, isAnnual: false },
    // Cùng NGÀY khác TÊN -> không chặn dòng chuẩn nào.
    { date: chuan[0].date, name: 'Nghỉ bù công ty', isAnnual: true },
  ]);

  const kq = await quickGenerateHolidays(kho.db, 2026, true);
  assert.equal(
    kq.skippedCount,
    1,
    'đúng một mục bị bỏ qua theo quy tắc cặp (date, name)',
  );
  assert.equal(
    kq.items.find((i) => i.date === chuan[1].date)?.alreadyCovered,
    true,
  );
  assert.equal(
    kq.items.find((i) => i.date === chuan[0].date)?.alreadyCovered,
    false,
  );
});

test('BUG-HRM-51: bất biến count(alreadyCovered=false) === addedCount ở CẢ dryRun lẫn ghi thật', async () => {
  const boGieo: Array<{
    ten: string;
    seed: Array<{ date: string; name: string; isAnnual?: boolean }>;
  }> = [
    { ten: 'kho trắng', seed: [] },
    {
      ten: 'một dòng lặp hàng năm của năm trước',
      seed: [{ date: '2026-01-01', name: 'Tết Dương lịch', isAnnual: true }],
    },
    {
      ten: 'đủ 5 dòng dương lịch lặp hàng năm của năm trước',
      seed: layDanhSach11NgayLeChuan(2026)
        .filter((t) => t.isAnnual)
        .map((t) => ({ date: t.date, name: t.name, isAnnual: true })),
    },
    {
      ten: 'dòng cũ isAnnual = false',
      seed: [
        {
          date: '2026-04-30',
          name: 'Ngày Giải phóng miền Nam',
          isAnnual: false,
        },
      ],
    },
    {
      ten: 'trùng trọn cặp của chính năm đang tạo',
      seed: layDanhSach11NgayLeChuan(2027)
        .slice(0, 3)
        .map((t) => ({ date: t.date, name: t.name })),
    },
  ];

  for (const { ten, seed } of boGieo) {
    for (let y = 2024; y <= 2030; y++) {
      const khoThu = taoKhoNgayLeGia(seed);
      khoThu.camGhiLai();
      const xemTruoc = await quickGenerateHolidays(khoThu.db, y, true);
      assert.equal(
        demSeTao(xemTruoc),
        xemTruoc.addedCount,
        `[dryRun ${y} / ${ten}] bất biến vỡ: ${demSeTao(xemTruoc)} vs ${xemTruoc.addedCount}`,
      );
      assert.equal(xemTruoc.skippedCount, 11 - xemTruoc.addedCount);
      assert.equal(khoThu.soLanCreateMany, 0);

      const khoThat = taoKhoNgayLeGia(seed);
      const soDongTruoc = khoThat.rows.length;
      const that = await quickGenerateHolidays(khoThat.db, y);
      assert.equal(
        demSeTao(that),
        that.addedCount,
        `[ghi thật ${y} / ${ten}] bất biến vỡ: ${demSeTao(that)} vs ${that.addedCount}`,
      );
      assert.equal(
        khoThat.rows.length - soDongTruoc,
        that.addedCount,
        `[ghi thật ${y} / ${ten}] số dòng tăng thêm phải đúng bằng addedCount`,
      );

      // Hai đường phải nhất quán tuyệt đối — đó là tính chất ADR-010 sinh ra để có.
      assert.deepEqual(
        that.items,
        xemTruoc.items,
        `[${y} / ${ten}] items[] hai đường lệch nhau`,
      );
      assert.equal(that.addedCount, xemTruoc.addedCount);
      assert.equal(that.skippedCount, xemTruoc.skippedCount);
    }
  }
});

/*
 * Hai ca dưới đây sinh ra từ KIỂM THỬ ĐỘT BIẾN: gieo lỗi `M4` (quy tắc phủ quên so TÊN) và `M10`
 * (một vế của phép so ngày/tháng đọc theo giờ địa phương) vào `holidays.service.ts` thì bộ ca
 * trước đó vẫn XANH TOÀN BỘ. Không có hai ca này thì hai lỗi đó lọt thẳng ra sản phẩm.
 */

test('BUG-HRM-51: quy tắc phủ phải so CẢ TÊN, không chỉ ngày/tháng', async () => {
  /*
   * Dòng gieo dưới đây hoàn toàn hợp lệ và tạo được bằng đường API bình thường: công ty đặt một
   * ngày nghỉ tên "Tết Dương lịch" vào 30/04 (gõ nhầm, hoặc cố ý đặt tên vậy), bật cờ lặp hàng
   * năm. Nếu quy tắc phủ chỉ so ngày/tháng mà bỏ tên, dòng này sẽ nuốt mất "Ngày Giải phóng miền
   * Nam" 30/04 của MỌI năm — mất hẳn một ngày nghỉ lễ khỏi lịch.
   */
  const kho = taoKhoNgayLeGia([
    { date: '2026-04-30', name: 'Tết Dương lịch', isAnnual: true },
  ]);

  const kq = await quickGenerateHolidays(kho.db, 2027);

  const giaiPhong = kq.items.find((i) => i.date === '2027-04-30');
  assert.ok(giaiPhong);
  assert.equal(giaiPhong.name, 'Ngày Giải phóng miền Nam');
  assert.equal(
    giaiPhong.alreadyCovered,
    false,
    'dòng cùng NGÀY nhưng khác TÊN không được phủ mục chuẩn nào',
  );

  const tetDuong = kq.items.find((i) => i.date === '2027-01-01');
  assert.ok(tetDuong);
  assert.equal(
    tetDuong.alreadyCovered,
    false,
    'dòng cùng TÊN nhưng khác NGÀY/THÁNG cũng không phủ được',
  );

  assert.equal(kq.addedCount, 11, 'không mục chuẩn nào bị phủ');
  assert.ok(kho.khoaDangCo().includes('2027-04-30|Ngày Giải phóng miền Nam'));
});

test('BUG-HRM-51: kết quả KHÔNG đổi theo múi giờ máy chủ (chạy lại dưới múi giờ ÂM)', async () => {
  /*
   * Cột `Holiday.date` là `@db.Date`, mọi đường ghi dựng bằng `new Date("YYYY-MM-DDT00:00:00Z")`.
   * Đọc bằng `getDate()/getMonth()` (giờ địa phương) thì trên máy chủ đặt múi giờ ÂM so với UTC,
   * `2026-01-01T00:00:00Z` hiện ra là **31/12/2025**. Chừng nào cả hai vế của phép so cùng lệch
   * thì kết quả vẫn khớp — nhưng chỉ cần MỘT vế đọc khác vế kia là quy tắc phủ hỏng, và hỏng
   * đúng ở môi trường sản phẩm chứ không phải trên máy lập trình viên (máy VN là UTC+7, hai cách
   * đọc trùng nhau nên lỗi vô hình).
   *
   * Ca này ép chạy lại đúng kịch bản `BUG-HRM-51` dưới `America/New_York` (UTC-5/-4).
   */
  const tzCu = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    if (new Date('2026-01-01T00:00:00.000Z').getDate() !== 31) {
      // Môi trường không cho đổi múi giờ lúc chạy -> ca này không kiểm được gì, bỏ qua trung thực
      // thay vì báo xanh giả.
      assert.ok(
        true,
        'môi trường không đổi được TZ lúc chạy — ca này không có hiệu lực ở đây',
      );
      return;
    }

    const kho = taoKhoNgayLeGia([
      { date: '2026-01-01', name: 'Tết Dương lịch', isAnnual: true },
    ]);
    const kq = await quickGenerateHolidays(kho.db, 2027);

    assert.equal(
      kq.items.find((i) => i.date === '2027-01-01')?.alreadyCovered,
      true,
      'dưới múi giờ âm, dòng lặp hàng năm vẫn phải phủ 01/01 của năm sau',
    );
    assert.equal(kq.addedCount, 10);
    assert.ok(!kho.khoaDangCo().includes('2027-01-01|Tết Dương lịch'));

    // Và chiều ngược lại: lễ âm lịch vẫn không bị phủ.
    const khoAm = taoKhoNgayLeGia([
      { date: '2026-02-06', name: 'Tết Nguyên Đán (Mùng 1)', isAnnual: true },
    ]);
    const kqAm = await quickGenerateHolidays(khoAm.db, 2027);
    assert.equal(kqAm.addedCount, 11);
    assert.ok(
      khoAm.khoaDangCo().includes('2027-02-06|Tết Nguyên Đán (Mùng 1)'),
    );
  } finally {
    if (tzCu === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = tzCu;
    }
  }
});
