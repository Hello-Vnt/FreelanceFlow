// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FreelanceFlow
/// @notice A freelancer's project board. Each completed milestone is stamped with the block
///         timestamp, so clients can verify progress. No tokens, no payments, no admin.
contract FreelanceFlow {
    struct Project {
        address owner;
        string title;
        string client;
        uint64 createdAt;
        uint8 total;
        uint8 done;
    }

    struct Milestone {
        string title;
        uint64 dueDate;
        uint64 completedAt; // 0 while open
    }

    uint256 public constant MAX_MILESTONES = 10;
    uint256 public constant MAX_TITLE_LENGTH = 80; // bytes, for project and milestone titles
    uint256 public constant MAX_CLIENT_LENGTH = 60; // bytes

    Project[] public projects;
    mapping(uint256 => Milestone[]) internal milestones;
    mapping(address => uint256[]) private _projectsOf;

    event ProjectCreated(uint256 indexed id, address indexed owner, string title);
    event MilestoneCompleted(uint256 indexed projectId, uint8 index, uint64 completedAt);

    error InvalidTitle();
    error InvalidClient();
    error InvalidMilestones();
    error InvalidDueDate();
    error ProjectNotFound();
    error MilestoneNotFound();
    error NotOwner();
    error AlreadyCompleted();

    function createProject(
        string calldata title,
        string calldata client,
        string[] calldata titles,
        uint64[] calldata dueDates
    ) external returns (uint256 id) {
        uint256 count = titles.length;
        if (count == 0 || count > MAX_MILESTONES || dueDates.length != count) revert InvalidMilestones();
        if (bytes(title).length == 0 || bytes(title).length > MAX_TITLE_LENGTH) revert InvalidTitle();
        if (bytes(client).length == 0 || bytes(client).length > MAX_CLIENT_LENGTH) revert InvalidClient();

        id = projects.length;
        projects.push(Project(msg.sender, title, client, uint64(block.timestamp), uint8(count), 0));

        Milestone[] storage list = milestones[id];
        for (uint256 i = 0; i < count; i++) {
            if (bytes(titles[i]).length == 0 || bytes(titles[i]).length > MAX_TITLE_LENGTH) revert InvalidTitle();
            if (dueDates[i] == 0) revert InvalidDueDate();
            list.push(Milestone(titles[i], dueDates[i], 0));
        }

        _projectsOf[msg.sender].push(id);
        emit ProjectCreated(id, msg.sender, title);
    }

    function completeMilestone(uint256 projectId, uint8 index) external {
        if (projectId >= projects.length) revert ProjectNotFound();
        Project storage project = projects[projectId];
        if (project.owner != msg.sender) revert NotOwner();
        if (index >= project.total) revert MilestoneNotFound();
        Milestone storage milestone = milestones[projectId][index];
        if (milestone.completedAt != 0) revert AlreadyCompleted();

        uint64 completedAt = uint64(block.timestamp);
        milestone.completedAt = completedAt;
        project.done += 1;
        emit MilestoneCompleted(projectId, index, completedAt);
    }

    function getProject(uint256 id) external view returns (Project memory, Milestone[] memory) {
        if (id >= projects.length) revert ProjectNotFound();
        return (projects[id], milestones[id]);
    }

    function projectsOf(address owner) external view returns (uint256[] memory) {
        return _projectsOf[owner];
    }

    function totalProjects() external view returns (uint256) {
        return projects.length;
    }
}
