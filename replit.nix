
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.pnpm
    pkgs.bashInteractive
    pkgs.jq
    pkgs.dos2unix
    pkgs.imagemagick
    pkgs.psmisc
    pkgs.rsync
  ];
}
