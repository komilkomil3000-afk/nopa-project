enum UserRole { mentor, superMentor, member }

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
  });

  int get zarikBalance => zarik;
}
