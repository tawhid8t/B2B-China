export type ClientBootstrapData = {
  profile: {
    id: string;
    email: string | null;
    fullName: string;
    role: "client";
    status: "active";
  };
  client: {
    id: string;
    businessName: string;
  };
};
