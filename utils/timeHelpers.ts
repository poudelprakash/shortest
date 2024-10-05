/**
* Converts a date to a human-readable "time ago" format.
*
* @param {Date | string} inputDate - The date to convert. Can be a Date object or a date string.
* @returns {string} A string representing how long ago the date was.
*/
export const timeAgo = (inputDate: string | number | Date) => {
 const now = new Date();
 const date = new Date(inputDate);

 const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 let interval = Math.floor(seconds / 31536000); // Seconds in a year
 if (interval >= 1) {
   return interval === 1 ? "1 year ago" : `${interval} years ago`;
 }

 interval = Math.floor(seconds / 2592000); // Seconds in a month
 if (interval >= 1) {
   return interval === 1 ? "1 month ago" : `${interval} months ago`;
 }

 interval = Math.floor(seconds / 86400); // Seconds in a day
 if (interval >= 1) {
   return interval === 1 ? "1 day ago" : `${interval} days ago`;
 }

 interval = Math.floor(seconds / 3600); // Seconds in an hour
 if (interval >= 1) {
   return interval === 1 ? "1 hour ago" : `${interval} hours ago`;
 }

 interval = Math.floor(seconds / 60); // Seconds in a minute
 if (interval >= 1) {
   return interval === 1 ? "1 minute ago" : `${interval} minutes ago`;
 }

 return "Just now";
}