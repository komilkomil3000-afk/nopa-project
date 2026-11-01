/// Display names of the assets. The server table (admin-editable) overrides these defaults at start.
///
/// Screens keep using the default text of an asset as its internal key (e.g. 'کلاف'); [labelFor] turns that
/// key into the name currently configured, so renaming an asset in the admin panel changes what users see
/// without touching any logic.
class AssetNames {
  static const Map<String, String> _defaults = {
    'zarik': 'زریک',
    'nakh': 'کلاف',
    'farsh': 'قالیچه',
    'derafsh': 'درفش',
    'derafsh_gold': 'درفش طلایی',
    'derafsh_silver': 'درفش نقره‌ای',
    'derafsh_bronze': 'درفش برنزی',
    'derafsh_cloth': 'درفش پارچه‌ای',
  };

  static const Map<String, String> _keyByDefaultLabel = {
    'زریک': 'zarik',
    'کلاف': 'nakh',
    'قالیچه': 'farsh',
    'درفش': 'derafsh',
    'درفش طلایی': 'derafsh_gold',
    'درفش نقره ای': 'derafsh_silver',
    'درفش نقره‌ای': 'derafsh_silver',
    'درفش برنزی': 'derafsh_bronze',
    'درفش پارچه‌ای': 'derafsh_cloth',
  };

  static final Map<String, String> _names = Map.of(_defaults);

  /// Current name of an asset key ('zarik', 'nakh', 'farsh', 'derafsh', 'derafsh_gold', ...).
  static String of(String key) => _names[key] ?? _defaults[key] ?? key;

  /// Current name for a screen's internal label; unknown labels are returned unchanged.
  static String labelFor(String defaultLabel) {
    final key = _keyByDefaultLabel[defaultLabel];
    return key == null ? defaultLabel : of(key);
  }

  /// Applies the rows returned by GET /assets ([{key, nameFa}]).
  static void apply(List<dynamic> rows) {
    for (final r in rows) {
      if (r is Map && r['key'] != null && r['nameFa'] != null) {
        final name = r['nameFa'].toString().trim();
        if (name.isNotEmpty) _names[r['key'].toString()] = name;
      }
    }
  }
}
