/// One class category of a station exactly as it is defined in the admin panel (CRM).
///
/// A station may have any number of categories with any title ("مهارتی", "شناختی", "رسانه‌ای", ...).
/// The app never guesses a category's kind from keywords in its title: every screen shows the categories in
/// their admin-panel order, under the title the admin gave them.
/// An instructor of a category: name and photo (from the admin panel's instructor bank).
class CategoryInstructor {
  final String name;
  final String avatarUrl;
  final String degree;
  const CategoryInstructor({required this.name, this.avatarUrl = '', this.degree = ''});
}

class StationCategory {
  final String id;
  final String title;
  final int index;
  final List<Map<String, dynamic>> sessions;
  /// Details shown in the «مشخصات جلسه» tab, as the admin entered them.
  final String description;
  final List<CategoryInstructor> instructors;
  final String handoutUrl;
  final String handoutTitle;

  const StationCategory({
    required this.id,
    required this.title,
    required this.index,
    required this.sessions,
    this.description = '',
    this.instructors = const [],
    this.handoutUrl = '',
    this.handoutTitle = '',
  });

  /// Short label for a tab: the title without a leading "کلاس‌های" / "کلاس" / "دسته" (e.g. "کلاس‌های شناختی" -> "شناختی").
  String get shortTitle => StationCategories.shortLabel(title);

  /// Label for a stat box: "کلاس" followed by the short title.
  String get classLabel => 'کلاس $shortTitle';

  /// Stored with the student's progress; kept as 'skill' / 'media' for the first two categories (older rows use them).
  String get trackType => StationCategories.trackTypeFor(index);
}

class StationCategories {
  static const String skill = 'skill';
  static const String media = 'media';

  static final RegExp _prefix = RegExp(r'^\s*(کلاس[\u200c\s]*های|کلاسهای|کلاس|دسته[\u200c\s]*های|دسته)[\s\u200c:\-–]*');

  static String shortLabel(String title) {
    final t = title.trim();
    final stripped = t.replaceFirst(_prefix, '').trim();
    return stripped.isEmpty ? (t.isEmpty ? 'کلاس‌ها' : t) : stripped;
  }

  static String trackTypeFor(int index) => index == 0 ? skill : (index == 1 ? media : 'category_${index + 1}');

  /// Index of the category a progress track type points to (inverse of [trackTypeFor]), or null.
  static int? indexForTrackType(String? type) {
    if (type == null) return null;
    if (type == skill || type == 'skillClass') return 0;
    if (type == media || type == 'mediaClass') return 1;
    final m = RegExp(r'^category_(\d+)$').firstMatch(type);
    return m == null ? null : int.parse(m.group(1)!) - 1;
  }

  /// The station's categories in admin-panel order, each with its live (not deleted) sessions and their clips.
  static List<StationCategory> parse(List<dynamic>? categories) {
    final cats = (categories ?? const []).whereType<Map>().toList();
    final indexed = List.generate(cats.length, (i) => i);
    // Stable sort by orderIndex; the server order breaks ties
    indexed.sort((a, b) {
      final oa = (cats[a]['orderIndex'] as num?)?.toInt() ?? 0;
      final ob = (cats[b]['orderIndex'] as num?)?.toInt() ?? 0;
      return oa != ob ? oa.compareTo(ob) : a.compareTo(b);
    });
    final out = <StationCategory>[];
    for (final i in indexed) {
      final cat = cats[i];
      final sessions = (cat['sessions'] as List? ?? [])
          .whereType<Map>()
          .where((s) => s['isDeleted'] != true)
          .map((s) {
        final map = Map<String, dynamic>.from(s);
        map['videoClips'] = (map['videoClips'] as List? ?? [])
            .whereType<Map>()
            .map((c) => Map<String, dynamic>.from(c))
            .toList();
        return map;
      }).toList();
      final title = cat['title']?.toString().trim() ?? '';
      out.add(StationCategory(
        id: cat['id']?.toString() ?? 'cat_$i',
        title: title.isEmpty ? 'کلاس‌ها' : title,
        index: out.length,
        sessions: sessions,
        description: cat['description']?.toString() ?? '',
        instructors: [
          for (final i in (cat['instructorsInfo'] as List? ?? const []).whereType<Map>())
            if ((i['name']?.toString().trim() ?? '').isNotEmpty)
              CategoryInstructor(
                name: i['name'].toString().trim(),
                avatarUrl: i['avatarUrl']?.toString() ?? '',
                degree: i['degree']?.toString() ?? '',
              ),
        ],
        handoutUrl: cat['handoutUrl']?.toString() ?? '',
        handoutTitle: cat['handoutTitle']?.toString() ?? '',
      ));
    }
    return out;
  }
}
