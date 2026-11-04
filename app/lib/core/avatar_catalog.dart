/// Profile pictures bundled with the app (assets/avatars/). Being part of the app they never need a download
/// and always show offline. The server only stores the key, as `avatarUrl = "asset:<key>"`, plus `gender`.
class AvatarCatalog {
  AvatarCatalog._();

  static const String prefix = 'asset:';

  static const List<String> boys = ['boy_1', 'boy_2', 'boy_3', 'boy_4'];
  static const List<String> girls = ['girl_1', 'girl_2', 'girl_3', 'girl_4'];
  static const String mentorMale = 'mentor_male';
  static const String mentorFemale = 'mentor_female';

  static List<String> optionsFor(String? gender) => gender == 'female' ? girls : boys;

  static String assetPath(String key) => 'assets/avatars/$key.jpg';

  static String toStored(String key) => '$prefix$key';

  static bool isBundled(String? avatarUrl) => avatarUrl != null && avatarUrl.startsWith(prefix);

  /// Asset path for a stored avatar value (`asset:boy_2`), or null when it is not a bundled picture.
  static String? assetFor(String? avatarUrl) {
    if (!isBundled(avatarUrl)) return null;
    final key = avatarUrl!.substring(prefix.length);
    return (boys.contains(key) || girls.contains(key) || key == mentorMale || key == mentorFemale)
        ? assetPath(key)
        : null;
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
