import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/models/chat_models.dart';
import 'package:nopa_app/screens/chat/chat_cards.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';

ChatMessage _message(Map<String, dynamic> extra) => ChatMessage.fromJson({
      'id': 'm1',
      'spaceId': 's1',
      'seq': 5,
      'body': 'سلام',
      'createdAt': '2026-11-02T10:00:00.000Z',
      'sender': {'id': 'u2', 'name': 'سارا', 'role': 'student'},
      ...extra,
    });

Widget _bubble(ChatMessage message, {bool mine = false, VoidCallback? onThread, void Function(String)? onReact}) {
  return MaterialApp(
    home: Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        body: ChatMessageBubble(
          message: message,
          mine: mine,
          showSender: true,
          seen: false,
          myId: 'u1',
          onLongPress: () {},
          onOpenThread: onThread,
          onRetry: () {},
          onReact: onReact ?? (_) {},
        ),
      ),
    ),
  );
}

void main() {
  cardTests();
  testWidgets('shows sender, text and reaction counts', (tester) async {
    String? reacted;
    await tester.pumpWidget(_bubble(
      _message({
        'reactions': [
          {'type': 'bravo', 'userId': 'u1'},
          {'type': 'bravo', 'userId': 'u3'},
        ],
      }),
      onReact: (t) => reacted = t,
    ));
    expect(find.text('سارا'), findsWidgets);
    expect(find.text('سلام'), findsWidgets);
    await tester.tap(find.byIcon(Icons.auto_awesome_rounded));
    expect(reacted, 'bravo');
  });

  testWidgets('a deleted message hides its content', (tester) async {
    await tester.pumpWidget(_bubble(_message({'deleted': true, 'body': ''})));
    expect(find.text('این پیام حذف شده است'), findsWidgets);
  });

  testWidgets('the thread link appears only when a message has replies', (tester) async {
    var opened = false;
    await tester.pumpWidget(_bubble(_message({'threadReplies': 3}), onThread: () => opened = true));
    await tester.tap(find.byIcon(Icons.forum_rounded));
    expect(opened, isTrue);

    await tester.pumpWidget(_bubble(_message({}), onThread: () {}));
    expect(find.byIcon(Icons.forum_rounded), findsNothing);
  });

  testWidgets('a failed message of mine offers a retry', (tester) async {
    await tester.pumpWidget(_bubble(_message({})..sendState = ChatSendState.failed, mine: true));
    expect(find.byIcon(Icons.refresh_rounded), findsOneWidget);
  });
}

void cardTests() {
  ChatMessage card(Map<String, dynamic> extra) => _message({
        'kind': 'challenge',
        'topic': {'id': 't1', 'status': 'open'},
        'meta': {'title': 'چالش نمونه', 'tag': 'درون‌گروهی', 'category': 'intra_group', 'stationTitle': 'منزلگاه یک', 'creatorName': 'راهبر', 'reward': '0 تا 10 کلاف'},
        ...extra,
      });

  Widget wrap(Widget child) => MaterialApp(home: Directionality(textDirection: TextDirection.rtl, child: Scaffold(body: child)));

  testWidgets('a challenge card shows its tag, station, creator and reward', (tester) async {
    var thread = false;
    await tester.pumpWidget(wrap(ChallengeCard(message: card({}), onOpenThread: () => thread = true, onOpenInfo: () {}, onOpenChallenge: () {})));
    expect(find.text('درون‌گروهی'), findsWidgets);
    expect(find.text('چالش نمونه'), findsWidgets);
    expect(find.text('منزلگاه: منزلگاه یک'), findsWidgets);
    expect(find.text('ایجادکننده: راهبر'), findsWidgets);
    expect(find.text('جایزه: 0 تا 10 کلاف'), findsWidgets);
    await tester.tap(find.text('ورود به گفتگو').first);
    expect(thread, isTrue);
  });

  testWidgets('a poll counts votes and reports the choice', (tester) async {
    int? voted;
    final poll = _message({
      'kind': 'poll',
      'meta': {'question': 'کی؟', 'options': ['شنبه', 'یکشنبه']},
      'pollVotes': [
        {'option': 1, 'userId': 'u1'},
      ],
    });
    await tester.pumpWidget(wrap(PollCard(message: poll, myId: 'u1', onVote: (o) => voted = o)));
    expect(find.text('1 رأی'), findsWidgets);
    await tester.tap(find.text('شنبه').first);
    expect(voted, 0);
  });

  testWidgets('a tag and the best answer mark appear on a message', (tester) async {
    await tester.pumpWidget(_bubble(_message({
      'best': true,
      'tags': [
        {'id': 't', 'name': 'ایده برتر', 'color': '#DFB690'},
      ],
    })));
    expect(find.text('بهترین پاسخ'), findsWidgets);
    expect(find.text('ایده برتر'), findsWidgets);
  });
}
