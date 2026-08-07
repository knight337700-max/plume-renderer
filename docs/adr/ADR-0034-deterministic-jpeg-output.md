# ADR-0034: deterministic JPEG output

- 상태: Accepted (F3A)
- 결정: 기존 Sharp/libvips로 sRGB JPEG, `4:2:0`, progressive=false, metadata
  stripped를 고정하고, `AUTO_FIT` quality ladder에서 첫 byte-limit 통과값을
  선택한다.
- 근거: 공식 fixed profiles 대부분이 JPG/JPEG와 400KB/500KB/1MB 제한을 갖고
  있어 PNG-only는 실행 가능한 Profile이 아니다.
- 영향: transparent background JPEG는 명시적으로 ERROR다. encoder/library
  version은 Windows x64 lockfile/runtime 조건에 고정된다.
