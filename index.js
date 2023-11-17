const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-.*)?$/;

async function gitVersion() {
    const { stdout } = await exec.getExecOutput("git describe --tags");
    const cleanVersion = stdout.trim();

    if (!SEMVER_RE.test(cleanVersion)) {
        // Fallback
        return [0, 0, 0];
    }

    const semverMatch = cleanVersion.match(SEMVER_RE);
    return [
        parseInt(semverMatch[1]),
        parseInt(semverMatch[2]),
        parseInt(semverMatch[3]),
    ];
}

function bump(semver, majorMinorPatch) {
    if (majorMinorPatch === "major") {
        return `${semver[0] + 1}.${semver[1]}.${semver[2]}`;
    }

    if (majorMinorPatch === "minor") {
        return `${semver[0]}.${semver[1] + 1}.${semver[2]}`;
    }

    if (majorMinorPatch === "patch") {
        return `${semver[0]}.${semver[1]}.${semver[2] + 1}`;
    }

    throw new Error("Invalid bump type, must be one of major/minor/patch");
}

async function run() {
    try {
        const [ major, minor, patch ] = await gitVersion();
        if (github.context.eventName !== "push") {
            throw new Error("Action can only be setup to trigger on `push` events");
        }
        const commit = github.context.payload.head_commit.id;


        const prevVersion = `${major}.${minor}.${patch}`;
        const nextVersion = bump([major, minor, patch], "minor");
        core.info(`Repository bump ${prevVersion} => ${nextVersion}`);

        const token = core.getInput("token");
        const gh = github.getOctokit(token);

        gh.rest.repos.createRelease({
            ...github.context.repo,
            tag_name: nextVersion,
            target_commitish: commit,
            body: `Autorelease ${nextVersion}.`
        })
    } catch (e) {
        core.setFailed(e);
    }
}

run();