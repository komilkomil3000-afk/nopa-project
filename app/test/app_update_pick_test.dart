import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/services/app_update_service.dart';

void main() {
  const all = {'arm64-v8a': 'A64', 'armeabi-v7a': 'A32', 'x86_64': 'X64'};

  test('each phone gets the file of its own processor', () {
    expect(AppUpdateService.pickDownload('arm64-v8a', all).url, 'A64');
    expect(AppUpdateService.pickDownload('armeabi-v7a', all).url, 'A32');
    expect(AppUpdateService.pickDownload('x86_64', all).url, 'X64');
  });

  test('without its own file: the all-in-one file first', () {
    final p = AppUpdateService.pickDownload('x86_64', {'arm64-v8a': 'A64'}, universal: 'U');
    expect(p.url, 'U');
    expect(p.abi, 'universal');
  });

  test('a 64-bit ARM phone may take the 32-bit file, never the other way round', () {
    expect(AppUpdateService.pickDownload('arm64-v8a', {'armeabi-v7a': 'A32'}).url, 'A32');
    final p = AppUpdateService.pickDownload('armeabi-v7a', {'arm64-v8a': 'A64'});
    expect(p.url, isEmpty);
    expect(p.abi, 'armeabi-v7a');
  });

  test('an old server (one link only) still works', () {
    expect(AppUpdateService.pickDownload('arm64-v8a', const {}, legacy: 'OLD').url, 'OLD');
  });

  test('the abi of this test machine is one of the three names', () {
    expect(['arm64-v8a', 'armeabi-v7a', 'x86_64'], contains(AppUpdateService.deviceAbi()));
  });
}
