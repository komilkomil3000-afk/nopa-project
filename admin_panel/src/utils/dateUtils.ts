export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number, jm: number, jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 335];
  let jy = gy - 621;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  let jy2 = Math.floor(days / 12053);
  days %= 12053;
  jy += 33 * jy2;
  let jy3 = Math.floor(days / 1461);
  days %= 1461;
  jy += 4 * jy3;
  let jy4 = Math.floor(days / 365);
  if (jy4 > 3) jy4 = 3;
  jy += jy4;
  days %= 365;
  days = Math.floor(days);
  let jm = 0;
  let jd = 0;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  jy = Math.floor(jy);
  jm = Math.floor(jm);
  jd = Math.floor(jd);
  let jy2 = jy - 979;
  let days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + 79 + jd;
  if (jm < 7) {
    days += (jm - 1) * 31;
  } else {
    days += (jm - 7) * 30 + 186;
  }
  let gy = 1600 + 400 * Math.floor(days / 146097);
  days %= 146097;
  let leap = 1;
  if (days >= 36525) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) {
      days++;
    } else {
      leap = 0;
    }
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days >= 366) {
    leap = 0;
    days--;
    gy += Math.floor(days / 365);
    days %= 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (let i = 1; i <= 12; i++) {
    if (gd <= sal_a[i]) {
      gm = i;
      break;
    }
    gd -= sal_a[i];
  }
  return new Date(Date.UTC(gy, gm - 1, gd));
}
