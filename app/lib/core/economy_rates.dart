/// Money rules set by the admin in the panel. The built-in values apply until GET /economy answers.
class EconomyRates {
  EconomyRates._();

  static int nakhPerFarsh = 10;
  static int farshSalePrice = 50000;
  static bool allowBuyNakh = false;
  static int zarikPerNakh = 500;
  static int challengeMaxNakh = 10;

  static void apply(Map<String, dynamic> json) {
    int read(String key, int current) => (json[key] as num?)?.toInt() ?? current;
    nakhPerFarsh = read('nakhPerFarsh', nakhPerFarsh);
    farshSalePrice = read('farshSalePrice', farshSalePrice);
    zarikPerNakh = read('zarikPerNakh', zarikPerNakh);
    challengeMaxNakh = read('challengeMaxNakh', challengeMaxNakh);
    allowBuyNakh = json['allowBuyNakh'] == true;
  }

  /// The exchange between two labels: the amount must be a multiple of `step`, and each step pays `pays`.
  /// Null when that exchange is not allowed.
  static ({int step, int pays})? rule(String source, String target) {
    if (source == 'کلاف' && target == 'قالیچه') return (step: nakhPerFarsh, pays: 1);
    if (source == 'قالیچه' && target == 'زریک') return (step: 1, pays: farshSalePrice);
    if (source == 'زریک' && target == 'کلاف' && allowBuyNakh) return (step: zarikPerNakh, pays: 1);
    return null;
  }
}
