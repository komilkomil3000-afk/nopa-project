/// The three challenge categories («فرهنگ اصطلاحات»). The server (admin-editable, GET /challenge-taxonomy)
/// overrides these defaults at start, so renaming a category in the panel changes what users see.
///
/// Keys are the server's `Challenge.category`: 'individual' (چالش شخصی, by a mentor for chosen members),
/// 'intra_group' (چالش گروهی, by a mentor for the whole caravan), 'inter_group' (چالش فراگروهی, by the admin
/// for all caravans). The app's own bucket name 'group' means 'intra_group'.
class ChallengeTaxonomy {
  static const Map<String, Map<String, String>> _defaults = {
    'individual': {'label': 'چالش شخصی', 'shortLabel': 'شخصی'},
    'intra_group': {'label': 'چالش گروهی', 'shortLabel': 'گروهی'},
    'inter_group': {'label': 'چالش فراگروهی', 'shortLabel': 'فراگروهی'},
  };

  static final Map<String, Map<String, String>> _names = {
    for (final e in _defaults.entries) e.key: Map.of(e.value),
  };

  static String _key(String key) => key == 'group' ? 'intra_group' : key;

  /// Full name, e.g. «چالش فراگروهی».
  static String label(String key) => _names[_key(key)]?['label'] ?? _defaults['intra_group']!['label']!;

  /// Short name for tabs and tags, e.g. «فراگروهی».
  static String shortLabel(String key) => _names[_key(key)]?['shortLabel'] ?? _defaults['intra_group']!['shortLabel']!;

  /// Category key of a raw category value (server key, or an older label).
  static String keyOf(String? raw) {
    final r = (raw ?? '').toLowerCase();
    if (r.contains('inter') || r.contains('فرا') || r.contains('میان')) return 'inter_group';
    if (r.contains('individual') || r.contains('شخصی') || r.contains('فردی')) return 'individual';
    return 'intra_group';
  }

  /// Applies the list returned by GET /challenge-taxonomy ([{key, label, shortLabel, ...}]).
  static void apply(List<dynamic> rows) {
    for (final r in rows) {
      if (r is! Map) continue;
      final key = r['key']?.toString();
      if (key == null || !_names.containsKey(key)) continue;
      for (final field in const ['label', 'shortLabel']) {
        final v = r[field]?.toString().trim() ?? '';
        if (v.isNotEmpty) _names[key]![field] = v;
      }
    }
  }
}
