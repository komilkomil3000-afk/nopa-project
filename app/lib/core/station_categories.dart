/// A station's class categories are free text in the admin panel, so a category that is not named with
/// "مهارت" or "رسانه" must still land in the right tab. The title wins; a category without a keyword takes
/// the first free kind by its position (first = skill, second = media), the same rule the admin panel uses.
class StationCategories {
  static const String skill = 'skill';
  static const String media = 'media';

  /// Kind of every category, by index: 'skill', 'media' or null.
  static List<String?> kinds(List<String> titles) {
    final result = List<String?>.filled(titles.length, null);
    for (int i = 0; i < titles.length; i++) {
      if (titles[i].contains('مهارت')) {
        result[i] = skill;
      } else if (titles[i].contains('رسانه')) {
        result[i] = media;
      }
    }
    for (int i = 0; i < titles.length; i++) {
      if (result[i] != null) continue;
      if (!result.contains(skill)) {
        result[i] = skill;
      } else if (!result.contains(media)) {
        result[i] = media;
      }
    }
    return result;
  }

  /// Sessions (not deleted, each with a list of video clips) of every category, grouped by kind.
  static Map<String, List<Map<String, dynamic>>> split(List<dynamic> categories) {
    final cats = categories.whereType<Map>().toList();
    final kindList = kinds(cats.map((c) => c['title']?.toString() ?? '').toList());
    final out = <String, List<Map<String, dynamic>>>{skill: [], media: []};
    for (int i = 0; i < cats.length; i++) {
      final kind = kindList[i];
      if (kind == null) continue;
      final sessions = (cats[i]['sessions'] as List? ?? []).whereType<Map>().where((s) => s['isDeleted'] != true);
      for (final s in sessions) {
        final map = Map<String, dynamic>.from(s);
        map['videoClips'] = (map['videoClips'] as List? ?? [])
            .whereType<Map>()
            .map((c) => Map<String, dynamic>.from(c))
            .toList();
        out[kind]!.add(map);
      }
    }
    return out;
  }

  /// Same grouping for categories already keyed by title (title -> sessions).
  static Map<String, List<Map<String, dynamic>>> splitByTitle(Map<String, List<Map<String, dynamic>>> byTitle) {
    return split(byTitle.entries.map((e) => {'title': e.key, 'sessions': e.value}).toList());
  }
}
