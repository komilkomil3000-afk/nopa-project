
enum UserRole {
  member,
  mentor,
  superMentor,
  admin,
}

class UserModel {
  final String id;
  final String name;
  final String phoneNumber;
  final UserRole role;
  final bool isDualRole;
  final int zarik;
  final int nakh;
  final int beyragh;
  final int farsh;
  final bool hasEvaluatedMentorThisSeason;
  final bool hasPrePaidClasses;
  final int mentorLevel;
  final int levelFrame;
  final String? avatarUrl;
  final String? nationalId;
  final String? dateOfBirth;
  final bool identityVerified;
  final int totalTransactions;
  final int totalZarikPurchases;
  final String? socialGroupLink;
  final int? userCode;
  final List<dynamic>? mentorDocuments;
  final String? city;
  final String? caravanId;
  final String? caravanName;
  final String? caravanMentor;
  final String? mentorPhone;
  final int completedStationsCount;
  final int completedSessionsCount;
  final List<dynamic>? certificates;
  final List<dynamic>? caravanMembers;
  final int managedMembersCount;
  final double satisfactionScore;

  UserModel({
    required this.id,
    required this.name,
    required this.phoneNumber,
    required this.role,
    this.isDualRole = false,
    this.zarik = 0,
    this.nakh = 0,
    this.beyragh = 0,
    this.farsh = 0,
    this.hasEvaluatedMentorThisSeason = false,
    this.hasPrePaidClasses = true,
    this.mentorLevel = 1,
    this.levelFrame = 1,
    this.avatarUrl,
    this.nationalId,
    this.dateOfBirth,
    this.identityVerified = false,
    this.totalTransactions = 0,
    this.totalZarikPurchases = 0,
    this.socialGroupLink,
    this.userCode,
    this.mentorDocuments,
    this.city,
    this.caravanId,
    this.caravanName,
    this.caravanMentor,
    this.mentorPhone,
    this.completedStationsCount = 0,
    this.completedSessionsCount = 0,
    this.certificates,
    this.caravanMembers,
    this.managedMembersCount = 0,
    this.satisfactionScore = 0.0,
  });

  int get zarikBalance => zarik;

  UserModel copyWith({
    String? id,
    String? name,
    String? phoneNumber,
    UserRole? role,
    bool? isDualRole,
    int? zarik,
    int? nakh,
    int? beyragh,
    int? farsh,
    bool? hasEvaluatedMentorThisSeason,
    bool? hasPrePaidClasses,
    int? mentorLevel,
    int? levelFrame,
    String? avatarUrl,
    String? nationalId,
    String? dateOfBirth,
    bool? identityVerified,
    int? totalTransactions,
    int? totalZarikPurchases,
    String? socialGroupLink,
    int? userCode,
    List<dynamic>? mentorDocuments,
    String? city,
    String? caravanId,
    String? caravanName,
    String? caravanMentor,
    String? mentorPhone,
    int? completedStationsCount,
    int? completedSessionsCount,
    List<dynamic>? certificates,
    List<dynamic>? caravanMembers,
    int? managedMembersCount,
    double? satisfactionScore,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      role: role ?? this.role,
      isDualRole: isDualRole ?? this.isDualRole,
      zarik: zarik ?? this.zarik,
      nakh: nakh ?? this.nakh,
      beyragh: beyragh ?? this.beyragh,
      farsh: farsh ?? this.farsh,
      hasEvaluatedMentorThisSeason: hasEvaluatedMentorThisSeason ?? this.hasEvaluatedMentorThisSeason,
      hasPrePaidClasses: hasPrePaidClasses ?? this.hasPrePaidClasses,
      mentorLevel: mentorLevel ?? this.mentorLevel,
      levelFrame: levelFrame ?? this.levelFrame,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      nationalId: nationalId ?? this.nationalId,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      identityVerified: identityVerified ?? this.identityVerified,
      totalTransactions: totalTransactions ?? this.totalTransactions,
      totalZarikPurchases: totalZarikPurchases ?? this.totalZarikPurchases,
      socialGroupLink: socialGroupLink ?? this.socialGroupLink,
      userCode: userCode ?? this.userCode,
      mentorDocuments: mentorDocuments ?? this.mentorDocuments,
      city: city ?? this.city,
      caravanId: caravanId ?? this.caravanId,
      caravanName: caravanName ?? this.caravanName,
      caravanMentor: caravanMentor ?? this.caravanMentor,
      mentorPhone: mentorPhone ?? this.mentorPhone,
      completedStationsCount: completedStationsCount ?? this.completedStationsCount,
      completedSessionsCount: completedSessionsCount ?? this.completedSessionsCount,
      certificates: certificates ?? this.certificates,
      caravanMembers: caravanMembers ?? this.caravanMembers,
      managedMembersCount: managedMembersCount ?? this.managedMembersCount,
      satisfactionScore: satisfactionScore ?? this.satisfactionScore,
    );
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawRole = json['role']?.toString();
    final bool isDual = json['isDualRole'] == true || rawRole == 'admin';
    UserRole parsedRole = UserRole.member;
    if (rawRole == 'admin') {
      parsedRole = UserRole.admin;
    } else if (rawRole == 'mentor' || rawRole == 'superMentor' || rawRole == 'SUPER_MENTOR') {
      parsedRole = UserRole.mentor;
    }

    return UserModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'کاربر',
      phoneNumber: json['phoneNumber'] ?? '',
      role: parsedRole,
      isDualRole: isDual,
      zarik: json['zarikBalance'] ?? json['zarik'] ?? 0,
      nakh: json['nakh'] ?? 0,
      beyragh: json['beyragh'] ?? 0,
      farsh: json['farsh'] ?? 0,
      hasEvaluatedMentorThisSeason: json['hasEvaluatedMentorThisSeason'] ?? false,
      hasPrePaidClasses: json['hasPrePaidClasses'] ?? true,
      mentorLevel: json['mentorLevel'] ?? 1,
      levelFrame: json['levelFrame'] ?? 1,
      avatarUrl: json['avatarUrl'],
      nationalId: json['nationalId'],
      dateOfBirth: json['dateOfBirth'],
      identityVerified: json['identityVerified'] ?? false,
      totalTransactions: json['totalTransactions'] ?? 0,
      totalZarikPurchases: json['totalZarikPurchases'] ?? 0,
      socialGroupLink: json['socialGroupLink'],
      userCode: json['userCode'],
      mentorDocuments: json['mentorDocuments'],
      city: json['city'],
      caravanId: json['caravanId'],
      caravanName: json['caravanName'] ?? json['caravan']?['name'] ?? 'فاقد کاروان',
      caravanMentor: json['caravanMentor'] ?? json['caravan']?['mentor']?['name'] ?? 'تعیین نشده',
      mentorPhone: json['mentorPhone'] ?? json['caravan']?['mentor']?['phoneNumber'],
      completedStationsCount: json['completedStationsCount'] ?? 0,
      completedSessionsCount: json['completedSessionsCount'] ?? 0,
      certificates: json['certificates'] ?? [],
      caravanMembers: json['caravanMembers'],
      managedMembersCount: json['managedMembersCount'] ?? 0,
      satisfactionScore: (json['satisfactionScore'] ?? 0.0).toDouble(),
    );
  }
}
