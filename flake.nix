{
  description = "Mangy manga downloader, tracker, and Komga feeder";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      bun2nix,
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
      version = self.rev or "dirty";
      formatterFor = system:
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

      # flake check must build the real artifacts, not just evaluate them.
      checks = forAllSystems (pkgs: {
        web = self.packages.${pkgs.system}.web;
        app = self.packages.${pkgs.system}.app;
        bun-deps = self.packages.${pkgs.system}.bun-deps;
      });

      packages = forAllSystems (
        pkgs:
        let
          bun = pkgs.bun;
          bun2nixPkg = bun2nix.packages.${pkgs.system}.default;

          # Bun-compatible offline cache assembled from per-tarball
          # fixed-output fetches; see the generated bun.nix.
          bunDeps = bun2nixPkg.fetchBunDeps {
            bunNix = ./bun.nix;
          };

          copySource = ''
            mkdir -p "$out"
            # Real copies, not hardlinks: darwin sandbox builds run under
            # different _nixbldN users per attempt, so hardlinked store
            # files mix owners in one output and fail nix's ownership check.
            cp -a . "$out/"
            rm -f "$out/flake.nix" "$out/flake.lock"
          '';

          # Runtime bundle for server and worker.
          app = pkgs.stdenvNoCC.mkDerivation {
            pname = "mangy-app";
            inherit version;
            src = self;
            nativeBuildInputs = [ bun ];
            buildPhase = ''
              runHook preBuild
              export BUN_INSTALL_CACHE_DIR=${bunDeps}/share/bun-cache
              HOME="$TMPDIR" bun install --frozen-lockfile --ignore-scripts
              ${copySource}
              runHook postBuild
            '';
          };

          # Static web build, served by whatever front the host already runs.
          web = pkgs.stdenvNoCC.mkDerivation {
            pname = "mangy-web";
            inherit version;
            src = self;
            nativeBuildInputs = [ bun ];
            buildPhase = ''
              runHook preBuild
              export BUN_INSTALL_CACHE_DIR=${bunDeps}/share/bun-cache
              HOME="$TMPDIR" bun install --frozen-lockfile --ignore-scripts
              ${copySource}
              cd "$out/apps/web"
              # .bin shims are absent in store builds, so invoke vite by its
              # real entry file instead of the package script.
              HOME="$TMPDIR" bun node_modules/vite/bin/vite.js build
              runHook postBuild
            '';
            installPhase = ''
              mkdir -p "$out"
              cp -a apps/web/dist "$out/dist"
            '';
          };
        in
        {
          inherit app web bunDeps;
          default = app;
        }
      );

      devShells = forAllSystems (
        pkgs:
        let
          bun2nixPkg = bun2nix.packages.${pkgs.system}.default;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.bun
              pkgs.postgresql
              bun2nixPkg
            ];
          };
        }
      );

      nixosModules.default =
        {
          config,
          lib,
          pkgs,
          ...
        } @ args:
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