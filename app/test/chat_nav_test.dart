import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/core/economy_rates.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/widgets/bottom_nav_bar.dart';

Widget _nav({required bool chatEnabled, required void Function(int) onTap}) {
  return MaterialApp(
    home: Scaffold(
      bottomNavigationBar: CustomBottomNavBar(
        currentIndex: 0,
        role: UserRole.member,
        chatEnabled: chatEnabled,
        onTap: onTap,
      ),
    ),
  );
}

void main() {
  testWidgets('chat takes the place of profile only while it is enabled', (tester) async {
    int? tapped;
    await tester.pumpWidget(_nav(chatEnabled: true, onTap: (i) => tapped = i));
    expect(find.text('چت'), findsWidgets);
    expect(find.text('پروفایل'), findsNothing);
    await tester.tap(find.text('چت').first);
    expect(tapped, AppTabs.chat);

    await tester.pumpWidget(_nav(chatEnabled: false, onTap: (i) => tapped = i));
    expect(find.text('چت'), findsNothing);
    await tester.tap(find.text('پروفایل').first);
    expect(tapped, AppTabs.profile);
  });

  test('user model reads the role and the chat switch', () {
    final manager = UserModel.fromJson({'id': '1', 'role': 'channel_manager', 'features': {'chat': true}});
    expect(manager.role, UserRole.channelManager);
    expect(manager.chatEnabled, isTrue);

    final student = UserModel.fromJson({'id': '2', 'role': 'student'});
    expect(student.role, UserRole.member);
    expect(student.chatEnabled, isFalse);

    expect(UserModel.fromJson({'id': '3', 'role': 'SUPER_MENTOR'}).role, UserRole.superMentor);
  });

  test('exchange rules follow the rates from the panel', () {
    expect(EconomyRates.rule('زریک', 'کلاف'), isNull);
    expect(EconomyRates.rule('کلاف', 'قالیچه')?.step, 10);
    expect(EconomyRates.rule('قالیچه', 'زریک')?.pays, 50000);

    EconomyRates.apply({'nakhPerFarsh': 8, 'allowBuyNakh': true, 'zarikPerNakh': 700});
    expect(EconomyRates.rule('کلاف', 'قالیچه')?.step, 8);
    expect(EconomyRates.rule('زریک', 'کلاف')?.step, 700);
  });
}
