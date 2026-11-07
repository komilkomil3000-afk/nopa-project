/// Profile pictures. Ten are bundled with the app (assets/avatars/) so they never need a download and always show
/// offline; the panel («تصاویر اپلیکیشن» → تصاویر پروفایل) can add uploaded ones, replace or retire them.
/// The server stores the chosen picture itself in `avatarUrl`: `asset:<key>` for a bundled one, `/uploads/...` for an
/// uploaded one (shown like any network picture), so a user keeps their picture whatever happens to the list.
class AvatarCatalog {
  AvatarCatalog._();

  static const String prefix = 'asset:';

  static const List<String> boys = ['boy_1', 'boy_2', 'boy_3', 'boy_4'];
  static const List<String> girls = ['girl_1', 'girl_2', 'girl_3', 'girl_4'];
  static const String mentorMale = 'mentor_male';
  static const String mentorFemale = 'mentor_female';
  static const Set<String> _bundled = {...boys, ...girls, mentorMale, mentorFemale};

  /// The pictures the panel offers now, per group (male, female, mentor_male, mentor_female), as stored values.
  /// Filled from GET /app-images (`avatars`); empty until then, when the bundled sets are used.
  static final Map<String, List<String>> _offered = {};

  /// Applies the `avatars` part of GET /app-images.
  static void apply(dynamic avatars) {
    if (avatars is! Map) return;
    _offered.clear();
    avatars.forEach((group, values) {
      if (values is List) {
        _offered[group.toString()] = [for (final v in values) if (v != null && v.toString().isNotEmpty) v.toString()];
      }
    });
  }

  /// The stored values a user can pick from: `asset:boy_1`, `/uploads/...`.
  static List<String> optionsFor(String? gender, {bool mentor = false}) {
    final g = gender == 'female' ? 'female' : 'male';
    final group = mentor ? 'mentor_$g' : g;
    final offered = _offered[group];
    if (offered != null && offered.isNotEmpty) return offered;
    if (mentor) return [toStored(g == 'female' ? mentorFemale : mentorMale)];
    return (g == 'female' ? girls : boys).map(toStored).toList();
  }

  static String assetPath(String key) => 'assets/avatars/$key.jpg';

  static String toStored(String key) => '$prefix$key';

  static bool isBundled(String? avatarUrl) => avatarUrl != null && avatarUrl.startsWith(prefix);

  /// Asset path for a stored avatar value (`asset:boy_2`), or null when it is not a bundled picture.
  static String? assetFor(String? avatarUrl) {
    if (!isBundled(avatarUrl)) return null;
    final key = avatarUrl!.substring(prefix.length);
    return _bundled.contains(key) ? assetPath(key) : null;
  }

  /// The default picture of a mentor (راهبر), which depends only on gender.
  static String? mentorDefault(String? gender) {
    if (gender == 'female') return assetPath(mentorFemale);
    // A mentor whose gender was never recorded still gets a picture
    return assetPath(mentorMale);
  }

  /// Mentors and super mentors, however the role is spelled (mentor, super_mentor...).
  static bool isMentorRole(dynamic role) {
    final r = role.toString().toLowerCase().replaceAll(RegExp(r'[\s_-]'), '');
    return r == 'mentor' || r == 'supermentor';
  }
}
