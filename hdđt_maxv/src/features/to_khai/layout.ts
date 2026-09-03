/**
 * Kích thước bố cục dùng chung của màn Tờ khai.
 *
 * Để hằng ở file riêng (không export từ component) vì `react-refresh/only-export-components` đòi
 * một file chỉ export component HOẶC chỉ export hằng/hàm.
 */

/**
 * Bề rộng "khổ giấy" của tab Tờ khai — mẫu in và bảng "Các kỳ đã lập" cùng dùng để thẳng mép nhau.
 *
 * Cố ý HẸP hơn khung bảng kê: bảng kê 26 cột cần tràn ngang, còn mẫu in là tờ giấy — để nó giãn
 * hết bề ngang màn hình thì các ô số nằm cách nhãn cả gang tay, đọc rất mệt.
 */
export const KHO_GIAY_TO_KHAI = 860;
