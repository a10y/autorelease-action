const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

// Minimum tag if no existing tag exists for the repo
const DEFAULT_TAG = "0.0.0";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-.*)?$/;

async function gitVersion() {
    const output = await exec.getExecOutput("git describe --tags");
    if (!SEMVER_RE.test(output.stdout.trim())) {
        // Fallback
        return [0, 0, 0];
    }

    const semverMatch = output.stdout.match(SEMVER_RE);
    return [
        parseInt(semverMatch[1]),
        parseInt(semverMatch[2]),
        parseInt(semverMatch[3]),
    ];
}

function bump(semver, majorMinorPatch) {
    if (majorMinorPatch === "major") {
        return `${semver[1] + 1}.${semver[2]}.${semver[3]}`;
    }

    if (majorMinorPatch === "minor") {
        return `${semver[1]}.${semver[2] + 1}.${semver[3]}`;
    }

    if (majorMinorPatch === "patch") {
        return `${semver[1]}.${semver[2]}.${semver[3] + 1}`;
    }

    throw new Error("Invalid bump type, must be one of major/minor/patch");
}

async function run() {
    try {
        const [ major, minor, patch ] = await gitVersion();


        const prevVersion = `${major}.${minor}.${patch}`;
        const nextVersion = bump([major, minor, patch], "minor");
        core.info(`Repository bump ${prevVersion} => ${nextVersion}`);

        const token = core.getInput("token");
        const gh = github.getOctokit(token);

        // Get the list of pull requests
        const result = await gh.rest.git.createTag({
            ...github.context.repo,
            message: `autorelease bump ${prevVersion} => ${nextVersion}`,
            tag: nextVersion,
            object: "main", // Tag the HEAD of main. Should probably instead rely on the new version of main.
        });

        gh.rest.repos.createRelease({
            ...github.context.repo,
            tag_name: result.data.tag,
            body: `Autorelease bump ${tag}.`
        })
    } catch (e) {
        core.setFailed(e.message);
    }
}

run();