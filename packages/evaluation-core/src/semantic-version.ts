// major and minor should be non-negative numbers separated by a dot
const MAJOR_MINOR_REGEX = '(\\d+)\\.(\\d+)';

// patch should be a non-negative number
const PATCH_REGEX = '(\\d+)';

// prerelease is optional. If provided, it should be a hyphen followed by a
// series of dot separated identifiers where an identifer can contain anything in [-0-9a-zA-Z]
const PRERELEASE_REGEX = '(-(([-\\w]+\\.?)*))?';

// version pattern should be major.minor(.patchAndPreRelease) where .patchAndPreRelease is optional
const VERSION_PATTERN = `^${MAJOR_MINOR_REGEX}(\\.${PATCH_REGEX}${PRERELEASE_REGEX})?$`;

export class SemanticVersion {
  public readonly major: number;
  public readonly minor: number;
  public readonly patch: number;
  public readonly preRelease: string | undefined;

  constructor(
    major: number,
    minor: number,
    patch: number,
    preRelease: string | undefined = undefined,
  ) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.preRelease = preRelease;
  }

  public static parse(
    version: string | undefined,
  ): SemanticVersion | undefined {
    if (!version) {
      return undefined;
    }
    const matchGroup = new RegExp(VERSION_PATTERN).exec(version);
    if (!matchGroup) {
      return undefined;
    }
    const major = Number(matchGroup[1]);
    const minor = Number(matchGroup[2]);
    if (isNaN(major) || isNaN(minor)) {
      return undefined;
    }
    const patch = Number(matchGroup[4]) || 0;
    const preRelease = matchGroup[5] || undefined;
    return new SemanticVersion(major, minor, patch, preRelease);
  }

  public compareTo(other: SemanticVersion): number {
    if (this.major > other.major) return 1;
    if (this.major < other.major) return -1;
    if (this.minor > other.minor) return 1;
    if (this.minor < other.minor) return -1;
    if (this.patch > other.patch) return 1;
    if (this.patch < other.patch) return -1;
    if (this.preRelease && !other.preRelease) return -1;
    if (!this.preRelease && other.preRelease) return 1;
    if (this.preRelease && other.preRelease) {
      if (this.preRelease > other.preRelease) return 1;
      if (this.preRelease < other.preRelease) return -1;
      return 0;
    }
    return 0;
  }
}
