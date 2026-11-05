import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/widgets/app_toast.dart';

void main() {
  Future<BuildContext> pumpHost(WidgetTester tester) async {
    late BuildContext captured;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: Builder(builder: (context) {
        captured = context;
        return const SizedBox();
      })),
    ));
    return captured;
  }

  testWidgets('a change is applied only after the undo time', (tester) async {
    final context = await pumpHost(tester);
    var committed = 0;
    var undone = 0;
    AppToast.undoable(context, 'حذف شد', commit: () async {
      committed++;
      return null;
    }, onUndo: () => undone++);
    await tester.pump();
    expect(find.text('لغو'), findsOneWidget);

    await tester.pump(const Duration(seconds: 9));
    expect(committed, 0);
    await tester.pump(const Duration(seconds: 2));
    expect(committed, 1);
    expect(undone, 0);
    await tester.pumpAndSettle();
  });

  testWidgets('«لغو» keeps the change from ever being applied', (tester) async {
    final context = await pumpHost(tester);
    var committed = 0;
    var undone = 0;
    AppToast.undoable(context, 'ویرایش شد', commit: () async {
      committed++;
      return null;
    }, onUndo: () => undone++);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('لغو'));
    await tester.pump(const Duration(seconds: 12));
    expect(undone, 1);
    expect(committed, 0);
    await tester.pumpAndSettle();
  });

  testWidgets('a newer change applies the waiting one at once', (tester) async {
    final context = await pumpHost(tester);
    final log = <String>[];
    AppToast.undoable(context, 'اول', commit: () async {
      log.add('first');
      return null;
    });
    await tester.pump();
    AppToast.undoable(context, 'دوم', commit: () async {
      log.add('second');
      return null;
    });
    await tester.pump();
    expect(log, ['first']);
    await tester.pump(const Duration(seconds: 11));
    expect(log, ['first', 'second']);
    await tester.pumpAndSettle();
  });

  testWidgets('a failed change is put back on screen', (tester) async {
    final context = await pumpHost(tester);
    var undone = 0;
    AppToast.undoable(context, 'حذف شد', commit: () async => 'خطا', onUndo: () => undone++);
    await tester.pump(const Duration(seconds: 11));
    await tester.pump();
    expect(undone, 1);
    await tester.pumpAndSettle();
  });
}
