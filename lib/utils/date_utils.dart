class JalaliDateUtils {
  static Map<String, int> gregorianToJalali(int gy, int gm, int gd) {
    var gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 335];
    var jy = gy - 621;
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = 365 * gy + ((gy2 + 3) ~/ 4) - ((gy2 + 99) ~/ 100) + ((gy2 + 399) ~/ 400) - 80 + gd + gDM[gm - 1];
    var jy2 = days ~/ 12053;
    days %= 12053;
    jy += 33 * jy2;
    var jy3 = days ~/ 1461;
    days %= 1461;
    jy += 4 * jy3;
    var jy4 = days ~/ 365;
    if (jy4 > 3) jy4 = 3;
    jy += jy4;
    days %= 365;
    var jm = 0;
    var jd = 0;
    if (days < 186) {
      jm = 1 + (days ~/ 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + ((days - 186) ~/ 30);
      jd = 1 + ((days - 186) % 30);
    }
    return {'year': jy, 'month': jm, 'day': jd};
  }

  static DateTime jalaliToGregorian(int jy, int jm, int jd) {
    var jy2 = jy - 979;
    var days = 365 * jy2 + (jy2 ~/ 33) * 8 + (((jy2 % 33) + 3) ~/ 4) + 79 + jd;
    if (jm < 7) {
      days += (jm - 1) * 31;
    } else {
      days += (jm - 7) * 30 + 186;
    }
    var gy = 1600 + 400 * (days ~/ 146097);
    days %= 146097;
    var leap = 1;
    if (days >= 36525) {
      days--;
      gy += 100 * (days ~/ 36524);
      days %= 36524;
      if (days >= 365) {
        days++;
      } else {
        leap = 0;
      }
    }
    gy += 4 * (days ~/ 1461);
    days %= 1461;
    if (days >= 366) {
      leap = 0;
      days--;
      gy += (days ~/ 365);
      days %= 365;
    }
    var gd = days + 1;
    var salA = [0, 31, (leap == 1 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm = 0;
    for (var i = 1; i <= 12; i++) {
      if (gd <= salA[i]) {
        gm = i;
        break;
      }
      gd -= salA[i];
    }
    return DateTime.utc(gy, gm, gd);
  }
}
