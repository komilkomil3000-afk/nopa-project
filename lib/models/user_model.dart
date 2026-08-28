
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
  final List<dynamic>? certificates;
  final int managedMembersCount;
  final double satisfactionScore;

  UserModel({
    required this.id,
    required this.name,
    required this.phoneNumber,
    required this.role,
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
    this.certificates,
    this.managedMembersCount = 0,
    this.satisfactionScore = 0.0,
  });

  int get zarikBalance => zarik;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'کاربر',
      phoneNumber: json['phoneNumber'] ?? '',
      role: (json['role'] == 'mentor' || json['role'] == 'superMentor') ? UserRole.mentor : UserRole.member,
      zarik: json['zarikBalance'] ?? 0,
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
      certificates: json['certificates'] ?? [],
      managedMembersCount: json['managedMembersCount'] ?? 0,
      satisfactionScore: (json['satisfactionScore'] ?? 0).toDouble(),
    );
  }
}
