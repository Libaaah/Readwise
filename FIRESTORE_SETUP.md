# Cloud Firestore Setup

Enable Cloud Firestore for the Firebase project, then publish `firestore.rules`
from the Firebase console. Reading progress is stored under the signed-in user's
account, so it is available from any browser and device that signs in to that account.

Student accounts are published to the `studentDirectory` collection when a
student signs in. Teachers see only these student-directory records; parent
accounts can look up only the student email linked to their profile. Teacher
and linked-parent dashboards read the student's `lessonProgress` collection.
These views require the updated Firestore rules in this repository to be
published.

Existing student accounts are added to the shared directory the next time each
student signs in after deployment. Older lesson progress remains in that
student's existing `users/{uid}/lessonProgress` documents.
