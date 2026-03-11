import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import MixinStorage "blob-storage/Mixin";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Set "mo:core/Set";



actor {
  include MixinStorage();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  public type AttendanceStatus = {
    #present;
    #absent;
    #tardy;
    #excused;
  };

  public type AttendanceRecord = {
    date : Text;
    status : AttendanceStatus;
    reason : ?Text;
  };

  public type ContactMethod = {
    #phone;
    #email;
    #either;
  };

  public type GuardianContact = {
    id : Nat;
    firstName : Text;
    lastName : Text;
    relationship : Text;
    phone : Text;
    email : Text;
    preferredContactMethod : ContactMethod;
    languagePreference : Text;
    emergencyContact : Bool;
  };

  public type Accommodation = {
    id : Nat;
    description : Text;
  };

  public type BehaviorEntry = {
    date : Text;
    description : Text;
    consequence : ?Text;
  };

  public type BehaviorEntryType = {
    #incident;
    #praise;
  };

  public type BehaviorCategory = {
    #academic;
    #social;
    #safety;
    #respect;
    #responsibility;
    #other;
  };

  public type BehaviorSeverity = {
    #minor;
    #moderate;
    #major;
  };

  public type BehaviorLog = {
    entryId : Nat;
    studentName : Text;
    entryType : BehaviorEntryType;
    category : BehaviorCategory;
    context : Text;
    description : Text;
    severity : ?BehaviorSeverity;
    actionTaken : ?Text;
    followUpNeeded : Bool;
    loggedAt : Time.Time;
  };

  public type SENPlanType = {
    #iep;
    #plan504;
    #sen;
    #other;
    #none;
  };

  public type SENGoalStatus = {
    #notStarted;
    #inProgress;
    #met;
  };

  public type SENGoal = {
    id : Nat;
    description : Text;
    targetDate : Text;
    status : SENGoalStatus;
  };

  public type SENPlan = {
    planType : SENPlanType;
    startDate : Text;
    reviewDate : Text;
    expiryDate : Text;
    coordinator : Text;
    services : [Text];
    goals : [SENGoal];
    notes : Text;
  };

  public type Student = {
    studentId : Text;
    givenNames : Text;
    familyName : Text;
    preferredName : ?Text;
    gradeLevel : Text;
    photo : Text;
    accommodations : [Accommodation];
    allergies : [Text];
    medicalNotes : Text;
    attendanceRecords : [AttendanceRecord];
    guardianContacts : [GuardianContact];
    teacherNotes : Text;
    interventionPlans : Text; // keep for backwards compatibility
    behaviorEntries : [BehaviorEntry];
    createdAt : Time.Time;
    senPlan : ?SENPlan;
  };

  let students = Map.empty<Text, Student>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  var nextGuardianContactId = 0;
  var nextBehaviorEntryId = 0;
  var nextAccommodationId = 0;
  var nextBehaviorLogId = 1;
  var nextSENGoalId = 0;
  let behaviorLogs = Map.empty<Nat, BehaviorLog>();

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Student Management
  public shared ({ caller }) func addStudent(
    studentId : Text,
    givenNames : Text,
    familyName : Text,
    preferredName : ?Text,
    gradeLevel : Text,
    photo : Text,
    accommodations : [Accommodation],
    allergies : [Text],
    medicalNotes : Text,
    attendanceRecords : [AttendanceRecord],
    guardianContacts : [GuardianContact],
    teacherNotes : Text,
    interventionPlans : Text,
    behaviorEntries : [BehaviorEntry],
    senPlan : ?SENPlan,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add students");
    };
    if (students.containsKey(studentId)) {
      Runtime.trap("Student with that ID already exists");
    };
    let newStudent : Student = {
      studentId;
      givenNames;
      familyName;
      preferredName;
      gradeLevel;
      photo;
      accommodations;
      allergies;
      medicalNotes;
      attendanceRecords;
      guardianContacts;
      teacherNotes;
      interventionPlans;
      behaviorEntries;
      createdAt = Time.now();
      senPlan;
    };
    students.add(studentId, newStudent);
  };

  public query ({ caller }) func getStudentById(studentId : Text) : async Student {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get students by ID");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) { return student };
    };
  };

  public query ({ caller }) func getAllStudents() : async [Student] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get all students");
    };
    students.values().toArray();
  };

  public shared ({ caller }) func updateStudent(
    studentId : Text,
    givenNames : Text,
    familyName : Text,
    preferredName : ?Text,
    gradeLevel : Text,
    photo : Text,
    accommodations : [Accommodation],
    allergies : [Text],
    medicalNotes : Text,
    attendanceRecords : [AttendanceRecord],
    guardianContacts : [GuardianContact],
    teacherNotes : Text,
    interventionPlans : Text,
    behaviorEntries : [BehaviorEntry],
    senPlan : ?SENPlan,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update students");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?_existingStudent) {
        let updatedStudent : Student = {
          studentId;
          givenNames;
          familyName;
          preferredName;
          gradeLevel;
          photo;
          accommodations;
          allergies;
          medicalNotes;
          attendanceRecords;
          guardianContacts;
          teacherNotes;
          interventionPlans;
          behaviorEntries;
          createdAt = Time.now();
          senPlan;
        };
        students.add(studentId, updatedStudent);
      };
    };
  };

  public shared ({ caller }) func deleteStudent(studentId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete students");
    };
    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    students.remove(studentId);
  };

  // Guardian Contact Management
  public shared ({ caller }) func addGuardianContact(
    studentId : Text,
    firstName : Text,
    lastName : Text,
    relationship : Text,
    phone : Text,
    email : Text,
    preferredContactMethod : ContactMethod,
    languagePreference : Text,
    emergencyContact : Bool,
  ) : async GuardianContact {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add guardian contacts");
    };
    let newContact : GuardianContact = {
      id = nextGuardianContactId;
      firstName;
      lastName;
      relationship;
      phone;
      email;
      preferredContactMethod;
      languagePreference;
      emergencyContact;
    };
    nextGuardianContactId += 1;
    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    let student = students.get(studentId).unwrap();
    let updatedContacts = student.guardianContacts.concat([newContact]);
    let updatedStudent = { student with guardianContacts = updatedContacts };
    students.add(studentId, updatedStudent);
    newContact;
  };

  public shared ({ caller }) func updateGuardianContact(
    studentId : Text,
    contactId : Nat,
    firstName : Text,
    lastName : Text,
    relationship : Text,
    phone : Text,
    email : Text,
    preferredContactMethod : ContactMethod,
    languagePreference : Text,
    emergencyContact : Bool,
  ) : async GuardianContact {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update guardian contacts");
    };

    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    let student = students.get(studentId).unwrap();
    let contactExists = student.guardianContacts.any(func(c) { c.id == contactId });
    if (not contactExists) {
      Runtime.trap("Guardian contact not found");
    };
    let updatedContact : GuardianContact = {
      id = contactId;
      firstName;
      lastName;
      relationship;
      phone;
      email;
      preferredContactMethod;
      languagePreference;
      emergencyContact;
    };
    let filteredContacts = student.guardianContacts.filter(func(c) { c.id != contactId });
    let updatedContacts = filteredContacts.concat([updatedContact]);
    let updatedStudent = { student with guardianContacts = updatedContacts };
    students.add(studentId, updatedStudent);
    updatedContact;
  };

  public shared ({ caller }) func deleteGuardianContact(studentId : Text, contactId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete guardian contacts");
    };

    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    let student = students.get(studentId).unwrap();
    let contactExists = student.guardianContacts.any(func(c) { c.id == contactId });
    if (not contactExists) {
      Runtime.trap("Guardian contact not found");
    };
    let updatedContacts = student.guardianContacts.filter(func(c) { c.id != contactId });
    let updatedStudent = { student with guardianContacts = updatedContacts };
    students.add(studentId, updatedStudent);
  };

  // Behavior Entry Management
  public shared ({ caller }) func addBehaviorEntry(
    studentId : Text,
    date : Text,
    description : Text,
    consequence : ?Text,
  ) : async BehaviorEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add behavior entries");
    };

    let newEntry : BehaviorEntry = {
      date;
      description;
      consequence;
    };

    nextBehaviorEntryId += 1;

    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };

    let student = students.get(studentId).unwrap();
    let updatedEntries = student.behaviorEntries.concat([newEntry]);
    let updatedStudent = { student with behaviorEntries = updatedEntries };

    students.add(studentId, updatedStudent);

    newEntry;
  };

  public shared ({ caller }) func updateBehaviorEntry(
    studentId : Text,
    entryId : Nat,
    date : Text,
    description : Text,
    consequence : ?Text,
  ) : async BehaviorEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update behavior entries");
    };

    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    let student = students.get(studentId).unwrap();
    let entryExists = student.behaviorEntries.any(func(_entry) { true });
    if (not entryExists) {
      Runtime.trap("Behavior entry not found");
    };
    let updatedEntry : BehaviorEntry = {
      date;
      description;
      consequence;
    };
    let filteredEntries = student.behaviorEntries.filter(func(_entry) { true });
    let updatedEntries = filteredEntries.concat([updatedEntry]);
    let updatedStudent = { student with behaviorEntries = updatedEntries };
    students.add(studentId, updatedStudent);
    updatedEntry;
  };

  public shared ({ caller }) func deleteBehaviorEntry(studentId : Text, _entryId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete behavior entries");
    };
    if (not students.containsKey(studentId)) {
      Runtime.trap("Student not found");
    };
    let student = students.get(studentId).unwrap();
    let entryExists = student.behaviorEntries.any(func(_entry) { true });
    if (not entryExists) {
      Runtime.trap("Behavior entry not found");
    };
    let updatedEntries = student.behaviorEntries.filter(func(_entry) { false });
    let updatedStudent = { student with behaviorEntries = updatedEntries };
    students.add(studentId, updatedStudent);
  };

  // Query Functions
  public query ({ caller }) func getStudentsByClass(className : Text) : async [Student] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get students by class");
    };
    students.values().toArray().filter(
      func(student) {
        Text.equal(student.gradeLevel, className);
      }
    );
  };

  public query ({ caller }) func getStudentCountByClass(className : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get student count by class");
    };
    students.values().toArray().filter(
      func(student) {
        Text.equal(student.gradeLevel, className);
      }
    ).size();
  };

  public query ({ caller }) func getGuardiansByStudent(studentId : Text) : async [GuardianContact] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get guardians by student");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) { student.guardianContacts };
    };
  };

  public query ({ caller }) func getAccommodationsByStudent(studentId : Text) : async [Accommodation] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get accommodations by student");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) { student.accommodations };
    };
  };

  public query ({ caller }) func getBehaviorEntriesByStudent(studentId : Text) : async [BehaviorEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior entries by student");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) { student.behaviorEntries };
    };
  };

  // Behavior Log Management
  public query ({ caller }) func getAllBehaviorLogs() : async [BehaviorLog] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior logs");
    };
    behaviorLogs.values().toArray();
  };

  public query ({ caller }) func getBehaviorLogById(entryId : Nat) : async ?BehaviorLog {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior log by ID");
    };
    behaviorLogs.get(entryId);
  };

  public query ({ caller }) func getBehaviorLogsByStudent(studentName : Text) : async [BehaviorLog] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior logs by student");
    };
    let filteredIter = behaviorLogs.values().filter(
      func(log) {
        Text.equal(log.studentName, studentName);
      }
    );
    filteredIter.toArray();
  };

  public query ({ caller }) func getBehaviorLogsByType(entryType : BehaviorEntryType) : async [BehaviorLog] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior logs by type");
    };
    let filteredIter = behaviorLogs.values().filter(
      func(log) {
        switch (entryType, log.entryType) {
          case (#incident, #incident) { true };
          case (#praise, #praise) { true };
          case (_) { false };
        };
      }
    );
    filteredIter.toArray();
  };

  public query ({ caller }) func getBehaviorLogsByCategory(category : BehaviorCategory) : async [BehaviorLog] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get behavior logs by category");
    };
    let filteredIter = behaviorLogs.values().filter(
      func(log) {
        switch (category, log.category) {
          case (#academic, #academic) { true };
          case (#social, #social) { true };
          case (#safety, #safety) { true };
          case (#respect, #respect) { true };
          case (#responsibility, #responsibility) { true };
          case (#other, #other) { true };
          case (_) { false };
        };
      }
    );
    filteredIter.toArray();
  };

  public query ({ caller }) func getRoster() : async [Text] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get roster");
    };
    let namesSet = Set.empty<Text>();
    for (log in behaviorLogs.values()) {
      namesSet.add(log.studentName);
    };
    namesSet.toArray();
  };

  public shared ({ caller }) func addBehaviorLog(
    studentName : Text,
    entryType : BehaviorEntryType,
    category : BehaviorCategory,
    context : Text,
    description : Text,
    severity : ?BehaviorSeverity,
    actionTaken : ?Text,
    followUpNeeded : Bool,
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add behavior logs");
    };
    let newEntry : BehaviorLog = {
      entryId = nextBehaviorLogId;
      studentName;
      entryType;
      category;
      context;
      description;
      severity;
      actionTaken;
      followUpNeeded;
      loggedAt = Time.now();
    };
    behaviorLogs.add(nextBehaviorLogId, newEntry);
    nextBehaviorLogId += 1;
    nextBehaviorLogId - 1; // Return the entryId of the newly created log
  };

  public shared ({ caller }) func updateBehaviorLog(
    entryId : Nat,
    studentName : Text,
    entryType : BehaviorEntryType,
    category : BehaviorCategory,
    context : Text,
    description : Text,
    severity : ?BehaviorSeverity,
    actionTaken : ?Text,
    followUpNeeded : Bool,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update behavior logs");
    };
    if (not behaviorLogs.containsKey(entryId)) {
      Runtime.trap("Behavior log not found");
    };
    let updatedEntry : BehaviorLog = {
      entryId;
      studentName;
      entryType;
      category;
      context;
      description;
      severity;
      actionTaken;
      followUpNeeded;
      loggedAt = Time.now();
    };
    behaviorLogs.add(entryId, updatedEntry);
  };

  public shared ({ caller }) func deleteBehaviorLog(entryId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete behavior logs");
    };
    if (not behaviorLogs.containsKey(entryId)) {
      Runtime.trap("Behavior log not found");
    };
    behaviorLogs.remove(entryId);
  };

  // SEN/IEP/504 Plan Methods
  public shared ({ caller }) func updateSENPlan(
    studentId : Text,
    senPlan : SENPlan,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update SEN plans");
    };
    switch (students.get(studentId)) {
      case (null) { Runtime.trap("Student not found") };
      case (?student) {
        let updatedStudent = { student with senPlan = ?senPlan };
        students.add(studentId, updatedStudent);
      };
    };
  };

  public query ({ caller }) func getSENPlan(studentId : Text) : async ?SENPlan {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get SEN plans");
    };
    switch (students.get(studentId)) {
      case (null) { null };
      case (?student) { student.senPlan };
    };
  };

  // Seed Data
  public shared ({ caller }) func seedStudents() : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admin can seed example students");
    };

    // Only seed if no students currently exist
    if (students.values().toArray().size() > 0) {
      return;
    };

    let currentTime = Time.now();
    let exampleStudents : [Student] = [
      {
        studentId = "1";
        givenNames = "John";
        familyName = "Doe";
        preferredName = ?("Johnny");
        gradeLevel = "1";
        photo = "example.jpg";
        accommodations = [
          {
            id = 1;
            description = "Extra time for assignments";
          },
        ];
        allergies = ["Peanuts", "Dairy"];
        medicalNotes = "Peanut allergy. Carry EpiPen.";
        attendanceRecords = [];
        guardianContacts = [
          {
            id = 1;
            firstName = "Jane";
            lastName = "Doe";
            relationship = "Mother";
            phone = "123-456-7890";
            email = "jane.doe@example.com";
            preferredContactMethod = #either;
            languagePreference = "English";
            emergencyContact = true;
          }
        ];
        teacherNotes = "Struggles with reading comprehension. Shows improvement with extra practice.";
        interventionPlans = "Weekly reading sessions with specialist. Focus on phonics.";
        behaviorEntries = [{ date = "2023-05-20"; description = "Respectful and focused during reading time"; consequence = ?"Positive reinforcement" }];
        createdAt = currentTime;
        senPlan = ?{
          planType = #iep;
          startDate = "2024-01-15";
          reviewDate = "2024-06-15";
          expiryDate = "2025-01-15";
          coordinator = "Ms. Smith";
          services = ["Reading Support", "Speech Therapy"];
          goals = [
            {
              id = 1;
              description = "Improve reading comprehension";
              targetDate = "2024-06-15";
              status = #inProgress;
            },
            {
              id = 2;
              description = "Articulate basic phonemes";
              targetDate = "2024-06-15";
              status = #notStarted;
            }
          ];
          notes = "Weekly sessions with reading specialist and SLP";
        };
      },
      {
        studentId = "2";
        givenNames = "Jane";
        familyName = "Smith";
        preferredName = null;
        gradeLevel = "2";
        photo = "example2.jpg";
        accommodations = [
          {
            id = 2;
            description = "Speech therapy sessions";
          },
        ];
        allergies = [];
        medicalNotes = "Attends speech therapy twice a week.";
        attendanceRecords = [];
        guardianContacts = [
          {
            id = 2;
            firstName = "Sarah";
            lastName = "Smith";
            relationship = "Mother";
            phone = "987-654-3210";
            email = "sarah.smith@example.com";
            preferredContactMethod = #phone;
            languagePreference = "English";
            emergencyContact = true;
          }
        ];
        teacherNotes = "Practices speech exercises at home. Shows progress in phoneme production.";
        interventionPlans = "Speech therapy coordination with SLP. Focus on articulation.";
        behaviorEntries = [{ date = "2023-06-10"; description = "Active participation in speech therapy sessions"; consequence = ?"Positive reinforcement" }];
        createdAt = currentTime;
        senPlan = ?{
          planType = #plan504;
          startDate = "2023-05-01";
          reviewDate = "2024-05-01";
          expiryDate = "2025-05-01";
          coordinator = "Ms. Johnson";
          services = ["Extra Time for Tests", "Preferential Seating"];
          goals = [
            {
              id = 1;
              description = "Improve focus during class";
              targetDate = "2024-05-01";
              status = #inProgress;
            }
          ];
          notes = "504 plan includes accommodation for extended test time";
        };
      },
      {
        studentId = "3";
        givenNames = "Michael";
        familyName = "Brown";
        preferredName = ?("Mike");
        gradeLevel = "3";
        photo = "example3.jpg";
        accommodations = [
          {
            id = 3;
            description = "Math support academic support";
          },
        ];
        allergies = ["Gluten"];
        medicalNotes = "Occupational therapy twice weekly.";
        attendanceRecords = [];
        guardianContacts = [
          {
            id = 3;
            firstName = "Laura";
            lastName = "Brown";
            relationship = "Mother";
            phone = "555-555-5555";
            email = "laura.brown@example.com";
            preferredContactMethod = #email;
            languagePreference = "English";
            emergencyContact = true;
          }
        ];
        teacherNotes = "Needs additional support with writing and math skills";
        interventionPlans = "Work with resource teacher. Occupational therapy sessions.";
        behaviorEntries = [
          {
            date = "2023-06-15";
            description = "Struggles to complete math assignments";
            consequence = ?"Additional support provided";
          },
          {
            date = "2023-06-20";
            description = "Improvement in focus during occupational therapy";
            consequence = ?"Positive reinforcement";
          }
        ];
        createdAt = currentTime;
        senPlan = ?{
          planType = #sen;
          startDate = "2023-09-01";
          reviewDate = "2024-03-01";
          expiryDate = "2025-09-01";
          coordinator = "Ms. Williams";
          services = ["Math Support", "Occupational Therapy"];
          goals = [
            {
              id = 1;
              description = "Enhance Fine Motor Skills";
              targetDate = "2024-03-01";
              status = #inProgress;
            },
            {
              id = 2;
              description = "Improve Math Performance";
              targetDate = "2024-03-01";
              status = #notStarted;
            }
          ];
          notes = "SEN designation for math and physical support.";
        };
      }
    ];
    for (student in exampleStudents.values()) {
      students.add(student.studentId, student);
    };
  };
};
