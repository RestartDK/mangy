{
  description = "Mangy manga downloader, tracker, and Komga feeder";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      treefmt-nix,
      ...
    }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # `nix build .#bun-deps` prints the resolved hash when it does not match.
      # x86_64-linux is resolved by CI; x86_64-darwin resolves on first build.
      depsHashes = {
        aarch64-darwin = "sha256-ILxUaMvSCPBJqJkGN1q197IMHHOvVU/2fo8OFjTrb2s=";
        x86_64-darwin = "sha256-ILxUaMvSCPBJqJkGN1q197IMHHOvVU/2fo8OFjTrb2s=";
        x86_64-linux = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      };
      depsHashFor = system: depsHashes.${system} or (throw "no mangy bun deps hash for ${system}");
      version = self.rev or "dirty";
      formatterFor =
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          treefmtEval = treefmt-nix.lib.evalModule pkgs {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = true;
            programs.taplo.enable = true;
          };
        in
        treefmtEval.config.build.wrapper;
    in
    {
      formatter = nixpkgs.lib.genAttrs systems formatterFor;

      # flake check must build the real artifacts, not just evaluate them:
      # the Linux dependency hash only resolves under a real Linux build.
      checks = forAllSystems (pkgs: {
        web = self.packages.${pkgs.system}.web;
        app = self.packages.${pkgs.system}.app;
        bun-deps = self.packages.${pkgs.system}.bun-deps;
      });

      packages = forAllSystems (
        pkgs:
        let
          bun = pkgs.bun;

          # Fixed-output fetch of the complete installed tree so derivations
          # build offline. bunfig.toml sets the isolated linker: every
          # workspace carries its own node_modules and dependencies resolve
          # through relative symlinks into node_modules/.bun, so the whole
          # tree copies as one unit.
          bunDeps = pkgs.stdenvNoCC.mkDerivation {
            pname = "mangy-bun-deps";
            inherit version;
            src = self;
            nativeBuildInputs = [ bun ];
            # fixupPhase would patchShebangs every package script to a store
            # bash, embedding store references into a fixed-output artifact.
            dontFixup = true;
            outputHashMode = "recursive";
            outputHashAlgo = "sha256";
            outputHash = depsHashFor pkgs.system;
            buildPhase = ''
              runHook preBuild
              HOME="$TMPDIR" bun install --frozen-lockfile --ignore-scripts
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              # .bin shims are regenerated state and can vary between runs;
              # nothing here runs them, drizzle-kit is invoked by entry file.
              find . -type d -name .bin -path '*/node_modules/*' -exec rm -rf {} +
              mkdir -p "$out"
              cp -al . "$out/"
              # Keep the output hash independent of this flake's own files:
              # only bun.lock and the package manifests shape node_modules.
              rm -f "$out/flake.nix" "$out/flake.lock"
              runHook postInstall
            '';
          };

          # Runtime bundle for server and worker: the installed tree with a
          # writable copy of apps/web so vite can regenerate the router file.
          app = pkgs.stdenvNoCC.mkDerivation {
            pname = "mangy-app";
            inherit version;
            phases = [ "buildPhase" ];
            buildPhase = ''
              mkdir -p "$out"
              # Real copies, not hardlinks: darwin sandbox builds run under
              # different _nixbldN users per attempt, so hardlinked store
              # files mix owners in one output and fail nix's ownership check.
              cp -r ${bunDeps}/apps "$out/apps"
              cp -r ${bunDeps}/packages "$out/packages"
              cp -r ${bunDeps}/node_modules "$out/node_modules"
              cp ${bunDeps}/bunfig.toml "$out/bunfig.toml"
              cp ${bunDeps}/package.json "$out/package.json"
            '';
          };

          # Static web build, served by whatever front the host already runs.
          web = pkgs.stdenvNoCC.mkDerivation {
            pname = "mangy-web";
            inherit version;
            nativeBuildInputs = [ bun ];
            phases = [
              "buildPhase"
              "installPhase"
            ];
            buildPhase = ''
              mkdir -p "$out"
              # apps/ is a real copy: vite rewrites routeTree.gen.ts in place,
              # and darwin store files are immutable, so hardlinks cannot be
              # written or removed. packages/, node_modules/, and the manifests
              # are only ever read and stay hardlinked.
              cp -r ${bunDeps}/apps "$out/apps"
              # The copy preserves read-only modes; vite writes a timestamped
              # config bundle beside vite.config.ts. Real copies only, for the
              # same ownership reason as the app derivation.
              chmod -R u+w "$out/apps"
              cp -r ${bunDeps}/packages "$out/packages"
              cp -r ${bunDeps}/node_modules "$out/node_modules"
              cp ${bunDeps}/bunfig.toml "$out/bunfig.toml"
              cp ${bunDeps}/package.json "$out/package.json"
              cd "$out/apps/web"
              # .bin shims are stripped from the deps tree, so invoke vite by
              # its real entry file instead of the package script.
              HOME="$TMPDIR" bun node_modules/vite/bin/vite.js build
            '';
            installPhase = ''
              mkdir -p "$out"
              cp -r "$out/apps/web/dist" "$out/dist"
            '';
          };
        in
        {
          inherit
            app
            web
            ;
          bun-deps = bunDeps;
          default = app;
        }
      );

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.bun
            pkgs.postgresql
          ];
        };
      });

      nixosModules.default =
        {
          config,
          lib,
          pkgs,
          ...
        }@args:
        let
          cfg = config.services.mangy;
          bun = pkgs.bun;
          app = self.packages.${pkgs.system}.app;
          environmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        in
        {
          options.services.mangy = {
            enable = lib.mkEnableOption "Mangy manga downloader, tracker, and Komga feeder";

            user = lib.mkOption {
              type = lib.types.str;
              default = "mangy";
              description = "User the Mangy services run as.";
            };

            group = lib.mkOption {
              type = lib.types.str;
              default = "mangy";
              description = "Group the Mangy services run as. Add the user to a media group to reach download destinations.";
            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "Environment file with DATABASE_URL, BETTER_AUTH_SECRET, and worker settings.";
            };

            server = {
              listenAddress = lib.mkOption {
                type = lib.types.str;
                default = "127.0.0.1";
                description = "Address the Mangy API listens on.";
              };
              port = lib.mkOption {
                type = lib.types.port;
                default = 3000;
                description = "Port the Mangy API listens on.";
              };
            };
          };

          config = lib.mkIf cfg.enable {
            users.users.mangy = lib.mkIf (cfg.user == "mangy") {
              isSystemUser = true;
              group = cfg.group;
            };
            users.groups.mangy = lib.mkIf (cfg.group == "mangy") { };

            systemd.services.mangy-migrate = {
              description = "Apply Mangy database migrations";
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];
              before = [
                "mangy-server.service"
                "mangy-worker.service"
              ];
              serviceConfig = {
                Type = "oneshot";
                User = cfg.user;
                Group = cfg.group;
                WorkingDirectory = "${app}/packages/db";
                ExecStart = "${bun}/bin/bun ${app}/packages/db/node_modules/drizzle-kit/bin.cjs migrate";
                EnvironmentFile = environmentFile;
                Environment = "NODE_ENV=production";
              };
            };

            systemd.services.mangy-server = {
              description = "Mangy API server";
              after = [
                "network.target"
                "mangy-migrate.service"
              ];
              requires = [ "mangy-migrate.service" ];
              wantedBy = [ "multi-user.target" ];
              serviceConfig = {
                User = cfg.user;
                Group = cfg.group;
                WorkingDirectory = "${app}/apps/server";
                ExecStart = "${bun}/bin/bun run src/index.ts";
                EnvironmentFile = environmentFile;
                Environment = [
                  "NODE_ENV=production"
                  "HOST=${cfg.server.listenAddress}"
                  "PORT=${toString cfg.server.port}"
                ];
                Restart = "on-failure";
                RestartSec = "5s";
              };
            };

            systemd.services.mangy-worker = {
              description = "Mangy download and tracking worker";
              after = [
                "network.target"
                "mangy-migrate.service"
              ];
              requires = [ "mangy-migrate.service" ];
              wantedBy = [ "multi-user.target" ];
              serviceConfig = {
                User = cfg.user;
                Group = cfg.group;
                WorkingDirectory = "${app}/apps/worker";
                ExecStart = "${bun}/bin/bun run src/index.ts";
                EnvironmentFile = environmentFile;
                Environment = "NODE_ENV=production";
                Restart = "on-failure";
                RestartSec = "5s";
              };
            };
          };
        };
    };
}
