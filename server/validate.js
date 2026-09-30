export const CATEGORIES = ['Incident', 'Service Request', 'Access', 'Change', 'Problem'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export const PROJECT_TYPES = ['Implementation', 'Support', 'Internal', 'Migration', 'Audit'];
/** Match CasinWorks Projects sheet Status column */
export const PROJECT_STATUSES = ['Active', 'On hold', 'Blocked', 'Done'];

export const LEAD_SOURCES = ['Referral', 'Inbound', 'Outbound', 'Event', 'Partner'];
export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

function optionalString(value, max, label, errors) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    errors.push(`${label} must be a string`);
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    errors.push(`${label} must be ${max} characters or fewer`);
  }
  return trimmed;
}

export function validateCreateTicket(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const priority = typeof body.priority === 'string' ? body.priority.trim() : '';
  const requester = typeof body.requester === 'string' ? body.requester.trim() : '';
  const assignee = optionalString(body.assignee, 100, 'Assignee', errors);
  const client = optionalString(body.client, 100, 'Client', errors);
  const project = optionalString(body.project, 200, 'Project', errors);
  const coordinator = optionalString(body.coordinator, 100, 'Coordinator', errors);

  if (!title) errors.push('Title is required');
  if (title.length > 200) errors.push('Title must be 200 characters or fewer');
  if (!description) errors.push('Description (Summary) is required');
  if (description.length > 5000) errors.push('Description must be 5000 characters or fewer');
  if (!CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!PRIORITIES.includes(priority)) {
    errors.push(`Priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  if (!requester) errors.push('Requester is required');
  if (requester.length > 100) errors.push('Requester must be 100 characters or fewer');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      Title: title,
      Description: description,
      Category: category,
      Priority: priority,
      Status: 'Open',
      Requester: requester,
      Assignee: assignee,
      Client: client,
      Project: project,
      Coordinator: coordinator,
    },
  };
}

export function validateUpdateTicket(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const patch = {};
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  const hasAssignee = Object.prototype.hasOwnProperty.call(body, 'assignee');

  if (!hasStatus && !hasAssignee) {
    return { ok: false, errors: ['Provide status and/or assignee to update'] };
  }

  if (hasStatus) {
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${STATUSES.join(', ')}`);
    } else {
      patch.Status = status;
    }
  }

  if (hasAssignee) {
    const assignee = typeof body.assignee === 'string' ? body.assignee.trim() : '';
    if (assignee.length > 100) {
      errors.push('Assignee must be 100 characters or fewer');
    } else {
      patch.Assignee = assignee;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: patch };
}

export function validateCreateProject(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const priority = typeof body.priority === 'string' ? body.priority.trim() : '';
  const client = optionalString(body.client, 100, 'Client', errors);
  const owner = optionalString(body.owner, 100, 'Owner', errors);

  if (!title) errors.push('Title is required');
  if (!description) errors.push('Description is required');
  if (!PROJECT_TYPES.includes(type)) errors.push(`Type must be one of: ${PROJECT_TYPES.join(', ')}`);
  if (!PRIORITIES.includes(priority)) errors.push(`Priority must be one of: ${PRIORITIES.join(', ')}`);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      Title: title,
      Description: description,
      Type: type,
      Priority: priority,
      Status: 'Planning',
      Client: client,
      Owner: owner,
    },
  };
}

export function validateUpdateProject(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const patch = {};
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  const hasOwner = Object.prototype.hasOwnProperty.call(body, 'owner');

  if (!hasStatus && !hasOwner) {
    return { ok: false, errors: ['Provide status and/or owner to update'] };
  }

  if (hasStatus) {
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!PROJECT_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${PROJECT_STATUSES.join(', ')}`);
    } else {
      patch.Status = status;
    }
  }

  if (hasOwner) {
    patch.Owner = optionalString(body.owner, 100, 'Owner', errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: patch };
}

export function validateCreateLead(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  const owner = optionalString(body.owner, 100, 'Owner', errors);
  const notes = optionalString(body.notes, 5000, 'Notes', errors);
  const value = body.value == null || body.value === '' ? 0 : Number(body.value);

  if (!company) errors.push('Company is required');
  if (!contact) errors.push('Contact is required');
  if (!title) errors.push('Title is required');
  if (!LEAD_SOURCES.includes(source)) errors.push(`Source must be one of: ${LEAD_SOURCES.join(', ')}`);
  if (Number.isNaN(value) || value < 0) errors.push('Value must be a non-negative number');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      Company: company,
      Contact: contact,
      Title: title,
      Source: source,
      Status: 'New',
      Owner: owner,
      Value: value,
      Notes: notes,
    },
  };
}

export function validateUpdateLead(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const patch = {};
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  const hasOwner = Object.prototype.hasOwnProperty.call(body, 'owner');

  if (!hasStatus && !hasOwner) {
    return { ok: false, errors: ['Provide status and/or owner to update'] };
  }

  if (hasStatus) {
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!LEAD_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${LEAD_STATUSES.join(', ')}`);
    } else {
      patch.Status = status;
    }
  }

  if (hasOwner) {
    patch.Owner = optionalString(body.owner, 100, 'Owner', errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: patch };
}
