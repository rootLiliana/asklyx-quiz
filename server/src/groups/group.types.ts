export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
}

export interface GroupMembership {
  userId: string;
  groupId: string;
}

export interface GroupStudent {
  id: string;
  name: string;
  nickname: string;
  email: string;
}
