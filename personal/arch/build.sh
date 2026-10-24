#!/usr/bin/env bash
# Runs as root only inside an ephemeral Arch container, never on the host.
set -euo pipefail
pacman -Syu --noconfirm --needed desktop-file-utils
useradd -m -U builder
chown -R builder:builder /build
runuser -u builder -- bash -c 'cd /build && makepkg --nodeps --noconfirm'
packages=(/build/readest-personal-bin-*.pkg.tar.zst)
[[ ${#packages[@]} == 1 && -f "${packages[0]}" ]]
pacman -U --noconfirm "${packages[0]}"
pacman -Qk readest-personal-bin
desktop-file-validate /usr/share/applications/readest-personal.desktop
[[ -x /usr/bin/readest-personal && -u /usr/lib/readest-personal/chrome-sandbox ]]
for binary in /usr/lib/readest-personal/readest /usr/lib/readest-personal/*.so*; do
  ldd "$binary" > /tmp/readest-ldd.txt
  if grep -q 'not found' /tmp/readest-ldd.txt; then
    cat /tmp/readest-ldd.txt
    exit 1
  fi
done
pacman -R --noconfirm readest-personal-bin
[[ ! -e /usr/bin/readest-personal && ! -e /usr/lib/readest-personal ]]
echo 'Arch package build, install, dependencies, desktop entry and uninstall passed.'
