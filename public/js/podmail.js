var currentFolder = 0;
var currentPage = 0;
var currentMail = 0;
var click = false;
var deltaCount = 1;
var deltaCurrent = null;
$( document ).ready(function() {
        loadFolders();
        setTimeout('checkDelta();', 3000);
        $('.gre').gre();
        $('#left-hamburger').click(function() { leftBurgerClicked(); } );
        toggleFolders();
        if (window.location.pathname != '/about') pushState('/folder/0');
        checkSessionStorage();
        });

$( window ).resize(function() { toggleFolders(); });

function leftBurgerClicked()
{
    $("#col-menu").toggle();
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#listing").hide();
        $("#compose").hide();
        $("#mail").hide();
    }
    if (width < 768 && $("#col-menu").css("display") == "none") $("#listing").show();
}

function toggleFolders() {
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#col-menu").removeClass("col-2").removeClass("col-12").addClass("col-12").hide();
        $("#col-content").removeClass("col-10").removeClass("col-12").addClass("col-12").show();
        $("#left-hamburger").prop('disabled', false);
    } else {
        $("#col-menu").removeClass("col-2").removeClass("col-12").addClass("col-2").show();
        $("#col-content").removeClass("col-10").removeClass("col-12").addClass("col-10").show();
        $("#left-hamburger").prop('disabled', true);
    }
}

function loadFolders() {
    $("#pre-folders").load("/folders", loadedFolders);
}

function loadedFolders()
{
    loadFolder(currentFolder, currentPage);
}

function loadFolderClick(id)
{
    click = true;
    currentPage = 0;
    currentMail = 0;
    loadFolder(id);
}

function loadFolder(id, page)
{
    var url = "/folder/" + id + '/' + page;
    currentFolder = id;
    $("#listing").load(url, folderLoaded);
}

function loadPage(id, page)
{
    currentFolder = id;
    currentPage = page;
    $("#listing").load("/folder/" + id + '/' + page, folderLoaded);
}

function folderLoaded()
{
    $(".folder-link").css("font-weight", "");
    $(".folder-" + currentFolder).css("font-weight", "bold");

    $(".subjectrow").click(function() { mailClick(this); return false; } );
    $("#folders").html($("#pre-folders").html());
    $("#compose-start").click(function() { compose(); return false; });
    $(".folder-link").click(function (e) { loadFolderClick($(this).attr('folder')); return false; });
    if (click) {
        $("#mail").hide();
        $("#listing").show();
        $("#compose").hide();
        click = false;

        var width = parseInt($("body").css("width"));
        if (width <= 768) {
            $("#col-menu").hide();
        }
        pushState('/folder/' + currentFolder);
    }

    if (currentPage > 0) $('#prevpage').click(function() { loadPage(currentFolder, (currentPage - 1)); return false; });
    else $('#prevpage').removeAttr('href');
    if (currentPage < ($('#nextpage').attr('max') - 1)) $('#nextpage').click(function() { loadPage(currentFolder, (currentPage + 1)); return false; });
    else $('#nextpage').removeAttr('href');

    $("#mass-checkbox").click(function() { $(".mail-checkbox").prop('checked', $(this).prop('checked')); setMassButtons(); });
    $(".mail-checkbox").click(function() { setMassButtons(); });
    $("#mass-read").click(function() { massSetRead('true'); });
    $("#mass-unread").click(function() { massSetRead('false'); });
    $("#mass-delete").confirm({title:'Deleting multiple EveMails', content: 'This action CANNOT be undone!<br/>Are you sure?', type: 'red', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'DELETE', action: function() { massDelete(); } }, noop:{text:'Dismiss', action: function() {} }}});
    currentMail = 0;
}

function setMassButtons()
{
    var count = $(".mail-checkbox:checked").length;
    var isDisabled = (count == 0);
    $("#mass-delete").prop('disabled', isDisabled);
    $("#mass-read").prop('disabled', isDisabled);
    $("#mass-unread").prop('disabled', isDisabled);
}

function massSetRead(is_read)
{
    $(".mail-checkbox:checked").each(function() {
            mail_id = $(this).attr('mail_id');
            if (is_read == 'true') $(".mail-" + mail_id).removeClass('unread');
            else $(".mail-" + mail_id).addClass('unread');
            $.ajax('/action/mail/' + mail_id + '/is_read/' + is_read, {method: 'post'});
            });
    setTimeout("forceDelta();", 3000);
}

function massDelete()
{
    $(".mail-checkbox:checked").each(function() {
            mail_id = $(this).attr('mail_id');
            $("#mail-" + mail_id).addClass('strike');
            $.ajax('/action/mail/' + mail_id + '/delete/now', {method: 'post', complete: mailDeleted});
            });
    setTimeout("forceDelta();", 3000);
}

function mailClick(o)
{
    $("#mail").load(o.href, mailLoaded);
}

function mailLoaded(o)
{
    $("#showlisting").click(function() { history.back(); return false; });
    $('#unread_btn').click(function() { markMailUnread(this); });
    $('#delete_btn').confirm({title:'Deleting an EveMail', content: 'This action CANNOT be undone!<br/>Are you sure?', type: 'red', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'DELETE', action: function() { deleteMail($('#delete_btn'));  } }, noop:{text:'Dismiss', action: function() {} }}});
    $("#reply_btn").click(function() { reply(); return false; });
    $("#forward_btn").click(function() { forward(); return false; });
    $("#unread").hide();
    $("#listing").hide();
    $("#mail").show();
    var mail_id = $("#mail-id").html();
    currentMail = mail_id;
    pushState('/mail/' + mail_id);
}

function markMailUnread(btn)
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('unread');
    $("#unread").show();
    $.ajax('/action/mail/' + mail_id + '/is_read/false', {method: 'post'});
    setTimeout("forceDelta();", 3000);
}

function deleteMail(btn) 
{
    mail_id = $(btn).attr('mail_id');
    $("#mail-" + mail_id).addClass('strike');
    $.ajax('/action/mail/' + mail_id + '/delete/now', {method: 'post', complete: mailDeleted});
    setTimeout("forceDelta();", 3000);
}

function mailDeleted()
{
    showListing();
}

function showListing()
{
    $("#mail").hide();
    $("#listing").show();
    $("#compose").hide();
    //pushState('/folder/' + currentFolder);

}

function checkDelta()
{
    $.ajax('/delta', {success: processDelta, complete: nextDelta });
    nextDelta();
}

var delta_timeouts = [];
function nextDelta()
{
    // Clear existing delta timeouts
    for (var i = 0; i < delta_timeouts.length; i++) {
        clearTimeout(delta_timeouts[i]);
    }
    //quick reset of the timer array you just cleared
    delta_timeouts = [];

    delta_timeouts.push(setTimeout('checkDelta();', deltaCount * 1000));
}

function forceDelta()
{
    processDelta(JSON.stringify({delta:'0'}));
}

function processDelta(data)
{
    data = JSON.parse(data);
    if (deltaCurrent != data.delta) {
        deltaCurrent = data.delta;
        loadFolders();
        deltaCount = 1;
    } else if (deltaCount < 30) deltaCount++;
}

$(document).on('submit', '#compose_form', function() {            
        $("#compose-btn").attr("disabled", "disabled");
        $.ajax({
url     : $(this).attr('action'),
type    : $(this).attr('method'),
dataType: 'json',
data    : $(this).serialize(),
success : function( data ) {
if (data.error == false) {
$.confirm({title:'Sending EveMail...', content: data.message, type: 'green', useBootstrap: true, autoClose: 'noop|5000', backgroundDismiss:true, escapeKey:true, buttons: {purge:{ text: 'OK', action: function() {  } }, noop:{text:'Dismiss', action: function() {} }}});
$("#mail").hide();
$("#compose").hide();
$("#listing").show();
} else {
$.dialog({title: 'Sending EveMail...', content: data.message, type: 'red'});
}
$("#compose-btn").removeAttr("disabled")
},
error   : function( xhr, err ) {
console.log(err);
alert('Error');     
$("#compose-btn").removeAttr("disabled");
}
});    
return false;
});

function compose_prepare(recips = '', subject = '', body = '')
{
    $("#recipients").val(recips);
    $("#subject").val(subject);
    $("iframe").remove();
    $("#body").val(body);
    $(".gre").gre();
    $("#cancel-compose").click(function() { history.back();; return false; });
    var width = parseInt($("body").css("width"));
    if (width <= 768) {
        $("#col-menu").hide();
    }
}

function compose_show()
{
    $("#listing").hide();
    $("#mail").hide();
    $("#compose").show();
}

function compose()
{
    compose_prepare();
    compose_show();
    $("#recipients").focus();
}  

function reply()
{
    compose_prepare($("#mail-from").html(), "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
}

function forward()
{
    compose_prepare('', "Re: " + $("#mail-subject").html(), "<br/><br/>--------------------------------<br/>" + $("#mail-subject").html() + "<br/>" + "From: " + $("#mail-from").html() + "<br/>Sent: " + $("#mail-dttm").html() + "<br/>To: " + $("#mail-to").html() + "<br/><br/>" + $("#mail-body").html());
    compose_show();
    $("#recipients").focus();
}

$(window).on("popstate", function(e) {
        if (e.originalEvent.state !== null) {
            console.log(location.href);
            console.log(event.state);
            if (event.state.currentMail != 0) {
                console.log('load mail');
                $("#mail").load(location.href, mailLoaded);
                $("#listing").hide();
                $("#compose").hide();
                $("#mail").show();
            } else {
                console.log('load folder');
                loadFolder(event.state.currentFolder, event.state.currentPage);
                $("#mail").hide();
                $("#compose").hide();
                $("#listing").show();
            }
            return false;
        }
});

var lastState = null;
function pushState(newURL)
{
    if (newURL == lastState) return;
    lastState = newURL;
    console.log("pushing state " + newURL);
    state = {currentFolder: currentFolder, currentPage: currentPage, currentMail: currentMail};
    console.log(state);
    history.pushState(state, '', newURL);
}

function checkSessionStorage()
{
    var mail_id = sessionStorage.getItem("mail_id");
    var folder_id = sessionStorage.getItem("folder_id");
    sessionStorage.removeItem("mail_id");
    sessionStorage.removeItem("folder_id");
    if (mail_id) {
        console.log('session load mail ' + mail_id);
        $("#mail").load('/mail/' + mail_id, mailLoaded);
        $("#listing").hide();
        $("#compose").hide();
        $("#mail").show();
        return;
    }
    if (folder_id) {
        console.log('session load folder ' + folder_id);
        loadFolderClick(folder_id);
        $("#mail").hide();
        $("#compose").hide();
        $("#listing").show(); 
    }
}
